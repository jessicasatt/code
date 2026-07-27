import type { Appointment, CallEvent, Contact, Opportunity } from "../domain/types";
import { NotYetImplementedError, type HighLevelConnectionStatus, type HighLevelProvider, type ReconciliationResult } from "./provider";

const HIGHLEVEL_API_BASE = "https://services.leadconnectorhq.com";
/** HighLevel requires a fixed API version header on every request. */
const HIGHLEVEL_API_VERSION = "2021-07-28";

/**
 * Development-mode connection: a Private Integration Token + Location ID,
 * configured as server-only environment variables (never sent to the
 * browser). `refreshConnection` is safe to call today because it only
 * verifies the credential against a documented, stable endpoint.
 *
 * The data-fetching methods below are intentionally unimplemented until we
 * inspect one real webhook payload and one real API response together with
 * the account owner (SPEC.md: "Do not fabricate a HighLevel webhook
 * schema."). See HIGHLEVEL_INTEGRATION.md for the exact next step.
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
    throw new NotYetImplementedError("getContacts");
  }

  async getConversations(): Promise<unknown[]> {
    throw new NotYetImplementedError("getConversations");
  }

  async getCalls(): Promise<CallEvent[]> {
    throw new NotYetImplementedError("getCalls");
  }

  async getOpportunities(): Promise<Opportunity[]> {
    throw new NotYetImplementedError("getOpportunities");
  }

  async getAppointments(): Promise<Appointment[]> {
    throw new NotYetImplementedError("getAppointments");
  }

  async reconcileActivity(): Promise<ReconciliationResult> {
    throw new NotYetImplementedError("reconcileActivity");
  }
}
