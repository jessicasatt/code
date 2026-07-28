import { getSingleAppUserId } from "../data/single-user";
import { createAdminSupabaseClient } from "../supabase/admin";
import type { Appointment, CallEvent, Contact, Opportunity } from "../domain/types";
import { mapHighLevelCallMessage, mapHighLevelContact } from "./mappers";
import {
  NotYetImplementedError,
  type DateRange,
  type HighLevelConnectionStatus,
  type HighLevelProvider,
  type ReconciliationResult,
} from "./provider";

const HIGHLEVEL_API_BASE = "https://services.leadconnectorhq.com";
/** HighLevel requires a fixed API version header on every request. */
const HIGHLEVEL_API_VERSION = "2021-07-28";

/**
 * Development-mode connection: a Private Integration Token + Location ID,
 * configured as server-only environment variables (never sent to the
 * browser).
 *
 * Field names used below were confirmed against real responses from the
 * connected account's own API (GET /contacts/, GET /conversations/search,
 * GET /conversations/{id}/messages) — not guessed from docs, per SPEC.md's
 * rule against fabricating the payload shape. `getConversations`,
 * `getOpportunities`, and `getAppointments` remain unimplemented until
 * their real shapes are inspected the same way.
 */
export class PrivateIntegrationHighLevelProvider implements HighLevelProvider {
  constructor(
    private readonly token: string,
    private readonly locationId: string,
  ) {}

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Version: HIGHLEVEL_API_VERSION,
      Accept: "application/json",
    };
  }

  private async getJson(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${HIGHLEVEL_API_BASE}${path}`);
    url.searchParams.set("locationId", this.locationId);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, { headers: this.authHeaders(), cache: "no-store" });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HighLevel ${path} responded ${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
    }
    return response.json();
  }

  async refreshConnection(): Promise<HighLevelConnectionStatus> {
    try {
      const response = await fetch(`${HIGHLEVEL_API_BASE}/locations/${this.locationId}`, {
        headers: this.authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        return {
          connected: false,
          mode: "private_integration",
          locationId: this.locationId,
          lastVerifiedAt: new Date().toISOString(),
          error: `HighLevel responded ${response.status} ${response.statusText}`,
        };
      }
      return {
        connected: true,
        mode: "private_integration",
        locationId: this.locationId,
        lastVerifiedAt: new Date().toISOString(),
        error: null,
      };
    } catch (error) {
      return {
        connected: false,
        mode: "private_integration",
        locationId: this.locationId,
        lastVerifiedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown connection error",
      };
    }
  }

  async getContacts(): Promise<Contact[]> {
    const data = (await this.getJson("/contacts/", { limit: "100" })) as { contacts?: unknown[] };
    return (data.contacts ?? []).map((raw) => mapHighLevelContact("", raw));
  }

  async getConversations(): Promise<unknown[]> {
    throw new NotYetImplementedError("getConversations");
  }

  /** Recent conversations, most-recently-active first, capped at one page (100) — sufficient for periodic reconciliation of recent activity on a single-location MVP. */
  private async getRecentConversations(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.getJson("/conversations/search", { limit: "100" })) as {
      conversations?: Array<Record<string, unknown>>;
    };
    return data.conversations ?? [];
  }

  private async getCallMessagesForConversation(conversationId: string, range?: DateRange): Promise<Array<Record<string, unknown>>> {
    const data = (await this.getJson(`/conversations/${conversationId}/messages`, { limit: "50" })) as {
      messages?: { messages?: Array<Record<string, unknown>> };
    };
    const messages = data.messages?.messages ?? [];
    return messages.filter((m) => {
      if (m.messageType !== "TYPE_CALL") return false;
      if (!range) return true;
      const t = new Date(String(m.dateAdded)).getTime();
      return t >= range.from.getTime() && t <= range.to.getTime();
    });
  }

  async getCalls(range?: DateRange): Promise<CallEvent[]> {
    const conversations = await this.getRecentConversations();
    const calls: CallEvent[] = [];

    for (const conv of conversations) {
      // Conversations are returned most-recently-active first; once we're
      // past the requested range there's nothing older worth checking.
      if (range) {
        const lastActive = new Date(String(conv.lastMessageDate ?? conv.dateUpdated)).getTime();
        if (lastActive < range.from.getTime()) break;
      }
      const conversationId = String(conv.id);
      const callMessages = await this.getCallMessagesForConversation(conversationId, range);
      for (const msg of callMessages) {
        calls.push(mapHighLevelCallMessage("", conv.contactId ? String(conv.contactId) : null, msg));
      }
    }

    return calls;
  }

  async getOpportunities(): Promise<Opportunity[]> {
    throw new NotYetImplementedError("getOpportunities");
  }

  async getAppointments(): Promise<Appointment[]> {
    throw new NotYetImplementedError("getAppointments");
  }

  /**
   * Pulls recent conversations from the real HighLevel API and upserts any
   * call activity found into our own tables — this is what catches
   * activity missed by (or instead of) the webhook receiver. Contacts are
   * upserted from the lightweight fields already present on each
   * conversation summary, so this stays a single pass over the
   * conversation list plus one message-list call per active conversation.
   */
  async reconcileActivity(range: DateRange): Promise<ReconciliationResult> {
    const errors: string[] = [];
    let callsFound = 0;
    let callsInserted = 0;
    let callsAlreadyPresent = 0;

    try {
      const userId = await getSingleAppUserId();
      const supabase = createAdminSupabaseClient();
      const conversations = await this.getRecentConversations();
      const contactIdCache = new Map<string, string>(); // HighLevel contact id -> our contacts.id

      for (const conv of conversations) {
        const lastActive = new Date(String(conv.lastMessageDate ?? conv.dateUpdated)).getTime();
        if (lastActive < range.from.getTime()) break;

        const hlContactId = conv.contactId ? String(conv.contactId) : null;
        let ourContactId: string | null = null;

        if (hlContactId) {
          ourContactId = contactIdCache.get(hlContactId) ?? null;
          if (!ourContactId) {
            const contact = mapHighLevelContact(userId, {
              id: hlContactId,
              companyName: conv.companyName,
              contactName: conv.contactName,
              tags: conv.tags,
              dateUpdated: conv.dateUpdated,
            });
            const { data: contactRow, error: contactError } = await supabase
              .from("contacts")
              .upsert(
                {
                  user_id: userId,
                  highlevel_contact_id: contact.highlevelContactId,
                  business_name: contact.businessName,
                  contact_name: contact.contactName,
                  tags: contact.tags,
                  last_activity_at: contact.lastActivityAt,
                },
                { onConflict: "user_id,highlevel_contact_id" },
              )
              .select("id")
              .single();
            if (contactError) {
              errors.push(`Contact upsert failed for ${hlContactId}: ${contactError.message}`);
            } else {
              ourContactId = contactRow.id;
              contactIdCache.set(hlContactId, contactRow.id);
            }
          }
        }

        const conversationId = String(conv.id);
        let callMessages: Array<Record<string, unknown>>;
        try {
          callMessages = await this.getCallMessagesForConversation(conversationId, range);
        } catch (error) {
          errors.push(`Failed to fetch messages for conversation ${conversationId}: ${error instanceof Error ? error.message : error}`);
          continue;
        }

        for (const msg of callMessages) {
          callsFound += 1;
          const call = mapHighLevelCallMessage(userId, ourContactId, msg);
          const { error: insertError, count } = await supabase
            .from("call_events")
            .upsert(
              {
                user_id: userId,
                external_id: call.externalId,
                contact_id: call.contactId,
                direction: call.direction,
                start_time: call.startTime,
                end_time: call.endTime,
                duration_seconds: call.durationSeconds,
                provider_status: call.providerStatus,
                answered_status: call.answeredStatus,
                voicemail_status: call.voicemailStatus,
              },
              { onConflict: "user_id,external_id", ignoreDuplicates: true, count: "exact" },
            );
          if (insertError) {
            errors.push(`Call upsert failed for ${call.externalId}: ${insertError.message}`);
          } else if (count && count > 0) {
            callsInserted += 1;
          } else {
            callsAlreadyPresent += 1;
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      checkedFrom: range.from.toISOString(),
      checkedTo: range.to.toISOString(),
      callsFound,
      callsInserted,
      callsAlreadyPresent,
      errors,
    };
  }
}
