import type { Appointment, CallEvent, Contact, Opportunity } from "../domain/types";

/**
 * Everything the rest of the app knows about HighLevel goes through this
 * interface. UI components and domain logic depend only on this contract,
 * never on "development mode" vs. "OAuth mode" details, so OAuth can be
 * added later without touching callers.
 */
export type HighLevelConnectionMode = "private_integration" | "oauth" | "disconnected";

export interface HighLevelConnectionStatus {
  connected: boolean;
  mode: HighLevelConnectionMode;
  locationId: string | null;
  lastVerifiedAt: string | null;
  error: string | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ReconciliationResult {
  checkedFrom: string;
  checkedTo: string;
  callsFound: number;
  callsInserted: number;
  callsAlreadyPresent: number;
  errors: string[];
}

export interface HighLevelProvider {
  getContacts(range?: DateRange): Promise<Contact[]>;
  getConversations(range?: DateRange): Promise<unknown[]>;
  getCalls(range?: DateRange): Promise<CallEvent[]>;
  getOpportunities(range?: DateRange): Promise<Opportunity[]>;
  getAppointments(range?: DateRange): Promise<Appointment[]>;
  refreshConnection(): Promise<HighLevelConnectionStatus>;
  reconcileActivity(range: DateRange): Promise<ReconciliationResult>;
}

export class NotYetImplementedError extends Error {
  constructor(method: string) {
    super(
      `HighLevel.${method} is not implemented yet: SPEC.md forbids fabricating the exact HighLevel payload/endpoint shape. ` +
        `This lands once we inspect one real API response or webhook payload together (see HIGHLEVEL_INTEGRATION.md).`,
    );
    this.name = "NotYetImplementedError";
  }
}
