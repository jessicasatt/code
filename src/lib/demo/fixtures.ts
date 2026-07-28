import { dollarsToCents } from "../domain/money";
import type {
  Appointment,
  CallEvent,
  CoachingSettings,
  Contact,
  FollowUp,
  Goal,
  Opportunity,
  Profile,
  WorkBlock,
} from "../domain/types";

/**
 * Fictional businesses and activity for demo mode. Nothing here represents
 * a real prospect or a real call. Demo records are never mixed with
 * production records — this module is only ever read by the demo store.
 */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export function createDemoProfile(now: Date): Profile {
  return {
    userId: DEMO_USER_ID,
    name: "Jessica",
    morningBriefTime: "07:30",
    endOfDaySummaryTime: "18:00",
    callingHoursStart: "09:00",
    callingHoursEnd: "16:00",
    quietHoursStart: "20:00",
    quietHoursEnd: "07:00",
    workdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    onboardingCompletedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function createDemoCoachingSettings(now: Date): CoachingSettings {
  return {
    userId: DEMO_USER_ID,
    timezone: "America/Los_Angeles",
    desiredFirstCallTime: "09:00",
    defaultBlockSize: 10,
    inactivityThresholdMinutes: 25,
    behindPaceTolerancePct: 20,
    notificationCooldownMinutes: 45,
    maxProactiveNotificationsPerDay: 6,
    coachingIntensity: "standard",
    coachingPausedUntil: null,
    vacationMode: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function createDemoGoal(now: Date): Goal {
  return {
    userId: DEMO_USER_ID,
    monthlyRevenueGoalCents: dollarsToCents(10_000),
    currentMrrCents: dollarsToCents(4_250),
    averageClientValueCents: dollarsToCents(1_250),
    dailyCallTarget: 40,
    weeklyCallTarget: 175,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

const DEMO_BUSINESS_NAMES = [
  "Summit Roofing Co.",
  "BrightSmile Dental Group",
  "Cascade HVAC Services",
  "Riverfront Plumbing",
  "Evergreen Landscaping",
  "Pinnacle Auto Detailing",
  "Harbor View Realty",
  "GoldenGate Pest Control",
];
const NICHES = ["roofing", "dental", "hvac", "plumbing", "landscaping", "auto_detailing", "real_estate", "pest_control"];

export function createDemoContacts(): Contact[] {
  return DEMO_BUSINESS_NAMES.map((businessName, i) => ({
    id: `demo-contact-${i + 1}`,
    userId: DEMO_USER_ID,
    highlevelContactId: `demo-hl-contact-${i + 1}`,
    businessName,
    contactName: null,
    niche: NICHES[i],
    tags: ["demo"],
    timezone: "America/Los_Angeles",
    lastActivityAt: null,
  }));
}

export function createDemoOpportunities(contacts: Contact[]): Opportunity[] {
  return contacts.slice(0, 3).map((contact, i) => ({
    id: `demo-opp-${i + 1}`,
    userId: DEMO_USER_ID,
    highlevelOpportunityId: `demo-hl-opp-${i + 1}`,
    contactId: contact.id,
    pipeline: "GEO Services",
    stage: i === 0 ? "Proposal Sent" : "Discovery Call",
    status: "open",
    monetaryValueCents: dollarsToCents(1_250),
    monthlyRecurringValueCents: dollarsToCents(1_250),
    createdAtSource: new Date().toISOString(),
    updatedAtSource: new Date().toISOString(),
  }));
}

export function createDemoAppointments(contacts: Contact[], now: Date): Appointment[] {
  return [
    {
      id: "demo-appt-1",
      userId: DEMO_USER_ID,
      highlevelAppointmentId: "demo-hl-appt-1",
      contactId: contacts[1]?.id ?? null,
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      status: "confirmed",
      showStatus: "unknown",
      outcome: null,
    },
  ];
}

/** A handful of already-completed demo calls earlier today, so Today screen numbers aren't all zero on first load. */
export function createDemoCallEvents(contacts: Contact[], now: Date): CallEvent[] {
  return Array.from({ length: 6 }).map((_, i) => {
    const contact = contacts[i % contacts.length];
    const startTime = new Date(now.getTime() - (6 - i) * 25 * 60 * 1000);
    return {
      id: `demo-call-${i + 1}`,
      userId: DEMO_USER_ID,
      externalId: `demo-hl-call-${i + 1}`,
      contactId: contact.id,
      workBlockId: null,
      direction: "outbound",
      startTime: startTime.toISOString(),
      endTime: new Date(startTime.getTime() + 90_000).toISOString(),
      durationSeconds: 90,
      providerStatus: "completed",
      answeredStatus: i % 3 === 0 ? "answered" : i % 3 === 1 ? "no_answer" : "voicemail",
      voicemailStatus: i % 3 === 2,
      disposition: null,
      meaningfulConversation: i % 3 === 0,
      appointmentResult: i === 0,
      sourcePayloadId: null,
      createdAt: startTime.toISOString(),
    };
  });
}

export function createDemoWorkBlocks(): WorkBlock[] {
  return [];
}

export function createDemoFollowUps(contacts: Contact[], now: Date): FollowUp[] {
  return [
    {
      id: "demo-followup-1",
      userId: DEMO_USER_ID,
      contactId: contacts[3]?.id ?? null,
      opportunityId: null,
      dueAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      status: "due",
      notes: "Sent proposal last week, promised a follow-up call.",
    },
    {
      id: "demo-followup-2",
      userId: DEMO_USER_ID,
      contactId: contacts[5]?.id ?? null,
      opportunityId: null,
      dueAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      status: "due",
      notes: null,
    },
  ];
}
