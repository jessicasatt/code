import { getDemoState } from "../demo/store";
import type { Appointment, CallEvent, Contact, Opportunity } from "../domain/types";
import type { DateRange, HighLevelConnectionStatus, HighLevelProvider, ReconciliationResult } from "./provider";

function withinRange(iso: string, range?: DateRange): boolean {
  if (!range) return true;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

/** Backs the app with fixture data so it is fully clickable before a real HighLevel account is connected. */
export class DemoHighLevelProvider implements HighLevelProvider {
  async getContacts(): Promise<Contact[]> {
    return getDemoState().contacts;
  }

  async getConversations(): Promise<unknown[]> {
    return [];
  }

  async getCalls(range?: DateRange): Promise<CallEvent[]> {
    return getDemoState().callEvents.filter((c) => withinRange(c.startTime, range));
  }

  async getOpportunities(): Promise<Opportunity[]> {
    return getDemoState().opportunities;
  }

  async getAppointments(range?: DateRange): Promise<Appointment[]> {
    return getDemoState().appointments.filter((a) => withinRange(a.startTime, range));
  }

  async refreshConnection(): Promise<HighLevelConnectionStatus> {
    return {
      connected: true,
      mode: "disconnected",
      locationId: null,
      lastVerifiedAt: new Date().toISOString(),
      error: null,
    };
  }

  async reconcileActivity(range: DateRange): Promise<ReconciliationResult> {
    return {
      checkedFrom: range.from.toISOString(),
      checkedTo: range.to.toISOString(),
      callsFound: getDemoState().callEvents.length,
      callsInserted: 0,
      callsAlreadyPresent: getDemoState().callEvents.length,
      errors: [],
    };
  }
}
