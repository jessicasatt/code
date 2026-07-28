import { randomUUID } from "node:crypto";
import { isSameAppDay } from "../date/timezone";
import {
  createDemoAppointments,
  createDemoCallEvents,
  createDemoCoachingSettings,
  createDemoContacts,
  createDemoFollowUps,
  createDemoGoal,
  createDemoOpportunities,
  createDemoProfile,
  createDemoWorkBlocks,
  DEMO_USER_ID,
} from "./fixtures";

export { DEMO_USER_ID } from "./fixtures";
import type {
  Appointment,
  BehavioralCheckin,
  BehavioralCheckinReason,
  CallEvent,
  CoachingSettings,
  Contact,
  FollowUp,
  Goal,
  Opportunity,
  Profile,
  WorkBlock,
  WorkBlockStatus,
} from "../domain/types";
import { ALL_NOTIFICATION_CATEGORIES, type NotificationCategory } from "../domain/notifications";

export interface DemoState {
  profile: Profile;
  goal: Goal;
  coachingSettings: CoachingSettings;
  contacts: Contact[];
  opportunities: Opportunity[];
  appointments: Appointment[];
  callEvents: CallEvent[];
  workBlocks: WorkBlock[];
  behavioralCheckins: BehavioralCheckin[];
  followUps: FollowUp[];
  notificationPreferences: Record<NotificationCategory, boolean>;
  pushSubscriptionCount: number;
  onboarded: boolean;
}

function createDefaultNotificationPreferences(): Record<NotificationCategory, boolean> {
  return Object.fromEntries(ALL_NOTIFICATION_CATEGORIES.map((c) => [c, true])) as Record<NotificationCategory, boolean>;
}

function createSeedState(): DemoState {
  const now = new Date();
  const contacts = createDemoContacts();
  return {
    profile: createDemoProfile(now),
    goal: createDemoGoal(now),
    coachingSettings: createDemoCoachingSettings(now),
    contacts,
    opportunities: createDemoOpportunities(contacts),
    appointments: createDemoAppointments(contacts, now),
    callEvents: createDemoCallEvents(contacts, now),
    workBlocks: createDemoWorkBlocks(),
    behavioralCheckins: [],
    followUps: createDemoFollowUps(contacts, now),
    notificationPreferences: createDefaultNotificationPreferences(),
    pushSubscriptionCount: 0,
    onboarded: true,
  };
}

// Ephemeral, single-process, single-user in-memory state. This is only ever
// used when Supabase is not configured. Surviving hot-reload (via
// globalThis) matters for local dev; it intentionally does NOT survive
// across serverless invocations, which is fine because demo mode is a local
// evaluation aid, not a deployment target.
const DEMO_STATE_KEY = "__jessicaOsDemoState__";

type GlobalWithDemoState = typeof globalThis & { [DEMO_STATE_KEY]?: DemoState };

export function getDemoState(): DemoState {
  const g = globalThis as GlobalWithDemoState;
  if (!g[DEMO_STATE_KEY]) {
    g[DEMO_STATE_KEY] = createSeedState();
  }
  return g[DEMO_STATE_KEY];
}

export function resetDemoState(): DemoState {
  const g = globalThis as GlobalWithDemoState;
  g[DEMO_STATE_KEY] = createSeedState();
  return g[DEMO_STATE_KEY];
}

export function startDemoWorkBlock(input: { plannedStart: Date; plannedEnd: Date; callTarget: number }): WorkBlock {
  const state = getDemoState();
  const block: WorkBlock = {
    id: randomUUID(),
    userId: DEMO_USER_ID,
    plannedStart: input.plannedStart.toISOString(),
    plannedEnd: input.plannedEnd.toISOString(),
    actualStart: new Date().toISOString(),
    actualEnd: null,
    callTarget: input.callTarget,
    callsCompleted: 0,
    status: "active",
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.workBlocks = state.workBlocks.filter((b) => b.status !== "active");
  state.workBlocks.push(block);
  return block;
}

export function endDemoWorkBlock(blockId: string, status: Extract<WorkBlockStatus, "completed" | "cancelled">): WorkBlock | null {
  const state = getDemoState();
  const block = state.workBlocks.find((b) => b.id === blockId);
  if (!block) return null;
  block.status = status;
  block.actualEnd = new Date().toISOString();
  block.updatedAt = new Date().toISOString();
  return block;
}

export function getActiveDemoWorkBlock(): WorkBlock | null {
  return getDemoState().workBlocks.find((b) => b.status === "active") ?? null;
}

/** Simulates one HighLevel call event landing during an active block (used by the "Log quick result" button in demo mode). */
export function logDemoCallResult(input: {
  answeredStatus: CallEvent["answeredStatus"];
  meaningfulConversation: boolean;
}): CallEvent {
  const state = getDemoState();
  const now = new Date();
  const call: CallEvent = {
    id: randomUUID(),
    userId: DEMO_USER_ID,
    externalId: `demo-manual-${now.getTime()}`,
    contactId: state.contacts[0]?.id ?? null,
    workBlockId: getActiveDemoWorkBlock()?.id ?? null,
    direction: "outbound",
    startTime: now.toISOString(),
    endTime: now.toISOString(),
    durationSeconds: 60,
    providerStatus: "completed",
    answeredStatus: input.answeredStatus,
    voicemailStatus: input.answeredStatus === "voicemail",
    disposition: null,
    meaningfulConversation: input.meaningfulConversation,
    appointmentResult: false,
    sourcePayloadId: null,
    createdAt: now.toISOString(),
  };
  state.callEvents.push(call);

  const activeBlock = getActiveDemoWorkBlock();
  if (activeBlock) {
    activeBlock.callsCompleted += 1;
    activeBlock.lastActivityAt = now.toISOString();
    activeBlock.updatedAt = now.toISOString();
  }
  return call;
}

export function recordDemoBehavioralCheckin(input: {
  reason: BehavioralCheckinReason;
  note: string | null;
  trigger: string;
}): BehavioralCheckin {
  const state = getDemoState();
  const checkin: BehavioralCheckin = {
    id: randomUUID(),
    userId: DEMO_USER_ID,
    workBlockId: getActiveDemoWorkBlock()?.id ?? null,
    trigger: input.trigger,
    reason: input.reason,
    note: input.note,
    createdAt: new Date().toISOString(),
    resumedWithin10Min: null,
    resumedWithin30Min: null,
    resumedWithin60Min: null,
  };
  state.behavioralCheckins.push(checkin);
  return checkin;
}

export function updateDemoGoal(patch: Partial<Pick<Goal, "monthlyRevenueGoalCents" | "currentMrrCents" | "averageClientValueCents" | "dailyCallTarget" | "weeklyCallTarget">>): Goal {
  const state = getDemoState();
  state.goal = { ...state.goal, ...patch, updatedAt: new Date().toISOString() };
  return state.goal;
}

export type CoachingSettingsPatch = Partial<
  Pick<
    CoachingSettings,
    | "timezone"
    | "desiredFirstCallTime"
    | "defaultBlockSize"
    | "inactivityThresholdMinutes"
    | "behindPaceTolerancePct"
    | "notificationCooldownMinutes"
    | "maxProactiveNotificationsPerDay"
    | "coachingIntensity"
  >
>;

export function updateDemoCoachingSettings(patch: CoachingSettingsPatch): CoachingSettings {
  const state = getDemoState();
  state.coachingSettings = { ...state.coachingSettings, ...patch, updatedAt: new Date().toISOString() };
  return state.coachingSettings;
}

export function pauseDemoCoaching(until: Date | null): CoachingSettings {
  const state = getDemoState();
  state.coachingSettings = {
    ...state.coachingSettings,
    coachingPausedUntil: until ? until.toISOString() : null,
    vacationMode: false,
    updatedAt: new Date().toISOString(),
  };
  return state.coachingSettings;
}

export function setDemoVacationMode(enabled: boolean): CoachingSettings {
  const state = getDemoState();
  state.coachingSettings = {
    ...state.coachingSettings,
    vacationMode: enabled,
    coachingPausedUntil: null,
    updatedAt: new Date().toISOString(),
  };
  return state.coachingSettings;
}

export function callsCompletedOn(state: DemoState, day: Date): number {
  return state.callEvents.filter((c) => isSameAppDay(new Date(c.startTime), day)).length;
}

export function followUpsDueCount(state: DemoState): number {
  return state.followUps.filter((f) => f.status === "due").length;
}

export function setDemoNotificationPreference(category: NotificationCategory, enabled: boolean): void {
  const state = getDemoState();
  state.notificationPreferences[category] = enabled;
}
