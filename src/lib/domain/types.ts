import type { Cents } from "./money";

export type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

/** Distinguishes what kind of claim a piece of data is, per spec rule 8. */
export type DataProvenance = "recorded_fact" | "calculated_metric" | "ai_hypothesis";

export interface Profile {
  userId: string;
  name: string;
  morningBriefTime: string; // "HH:mm"
  endOfDaySummaryTime: string; // "HH:mm"
  callingHoursStart: string; // "HH:mm"
  callingHoursEnd: string; // "HH:mm"
  quietHoursStart: string; // "HH:mm"
  quietHoursEnd: string; // "HH:mm"
  workdays: Weekday[];
  onboardingCompletedAt: string | null; // ISO instant
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  userId: string;
  monthlyRevenueGoalCents: Cents;
  currentMrrCents: Cents;
  averageClientValueCents: Cents;
  dailyCallTarget: number;
  weeklyCallTarget: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkBlockStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface WorkBlock {
  id: string;
  userId: string;
  plannedStart: string; // ISO instant
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  callTarget: number;
  callsCompleted: number;
  status: WorkBlockStatus;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CallDirection = "inbound" | "outbound";
export type AnsweredStatus = "answered" | "no_answer" | "voicemail" | "unknown";

export interface CallEvent {
  id: string;
  userId: string;
  externalId: string;
  contactId: string | null;
  workBlockId: string | null;
  direction: CallDirection;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  providerStatus: string | null;
  answeredStatus: AnsweredStatus;
  voicemailStatus: boolean | null;
  disposition: string | null;
  meaningfulConversation: boolean | null;
  appointmentResult: boolean | null;
  sourcePayloadId: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  highlevelContactId: string;
  businessName: string | null;
  contactName: string | null;
  niche: string | null;
  tags: string[];
  timezone: string | null;
  lastActivityAt: string | null;
}

export type OpportunityStatus = "open" | "won" | "lost" | "abandoned";

export interface Opportunity {
  id: string;
  userId: string;
  highlevelOpportunityId: string;
  contactId: string | null;
  pipeline: string | null;
  stage: string | null;
  status: OpportunityStatus;
  monetaryValueCents: Cents;
  monthlyRecurringValueCents: Cents;
  createdAtSource: string;
  updatedAtSource: string;
}

export type AppointmentStatus = "scheduled" | "confirmed" | "cancelled" | "completed";
export type AppointmentShowStatus = "unknown" | "showed" | "no_show";

export interface Appointment {
  id: string;
  userId: string;
  highlevelAppointmentId: string;
  contactId: string | null;
  startTime: string;
  status: AppointmentStatus;
  showStatus: AppointmentShowStatus;
  outcome: string | null;
}

export type FollowUpStatus = "due" | "completed" | "snoozed" | "cancelled";

export interface FollowUp {
  id: string;
  userId: string;
  contactId: string | null;
  opportunityId: string | null;
  dueAt: string;
  status: FollowUpStatus;
  notes: string | null;
}

export const BEHAVIORAL_CHECKIN_REASONS = [
  "anxiety",
  "rejection",
  "distracted",
  "low_energy",
  "other_work",
  "technical_issue",
  "bad_lead_list",
  "needed_a_break",
  "completed_activity_elsewhere",
] as const;
export type BehavioralCheckinReason = (typeof BEHAVIORAL_CHECKIN_REASONS)[number];

export interface BehavioralCheckin {
  id: string;
  userId: string;
  workBlockId: string | null;
  trigger: string;
  reason: BehavioralCheckinReason;
  note: string | null;
  createdAt: string;
  resumedWithin10Min: boolean | null;
  resumedWithin30Min: boolean | null;
  resumedWithin60Min: boolean | null;
}

export type PaceStatus = "ahead" | "on_pace" | "behind";
