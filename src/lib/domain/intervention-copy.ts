import type { CoachingIntensity } from "./types";
import type { BehavioralState, BehavioralStateName } from "./behavioral-state";
import type { NotificationCategory } from "./notifications";

export interface InterventionCopy {
  category: NotificationCategory;
  title: string;
  body: string;
}

/**
 * Only states with no existing notification path get an entry here.
 * block_nearly_complete and block_complete are already handled by
 * event-driven notifications fired directly from src/lib/data/call-blocks.ts
 * and src/lib/highlevel/sync.ts when a call is actually logged — giving
 * them an entry here too would double-send. See PROACTIVE_COACHING_AUDIT.md.
 */
const STATE_TO_CATEGORY: Partial<Record<BehavioralStateName, NotificationCategory>> = {
  late_start: "late_start",
  behind_pace: "behind_pace",
  inactive_mid_block: "inactivity",
  daily_target_complete: "daily_target_complete",
  data_stale: "data_stale",
};

type CopyByIntensity = Record<CoachingIntensity, { title: string; body: string }>;

/**
 * One line per state per intensity. Never overwhelming, never the full
 * remaining target — every message is a single next hill, not the
 * mountain, per the product's core principle.
 */
const COPY: Partial<Record<BehavioralStateName, CopyByIntensity>> = {
  late_start: {
    gentle: { title: "Whenever you're ready", body: "No calls logged yet today — one call is enough to start." },
    standard: { title: "Time for your first call", body: "No calls logged yet today. Make one call to get moving." },
    direct: { title: "Start now", body: "No calls yet today. Make one call right now." },
  },
  behind_pace: {
    gentle: {
      title: "A gentle check-in",
      body: "You're a bit behind today's pace — a short call block could help close the gap.",
    },
    standard: { title: "Behind today's pace", body: "You're behind where you'd expect to be today. Consider a short call block." },
    direct: { title: "Behind pace", body: "You're behind today's pace. Start a call block now." },
  },
  inactive_mid_block: {
    gentle: { title: "Still there?", body: "It's been quiet for a bit. Whenever you're ready, one call restarts things." },
    standard: { title: "Paused", body: "You paused during your block. Restart with one call." },
    direct: { title: "You paused", body: "No call in a while during this block. Make one call now." },
  },
  daily_target_complete: {
    gentle: { title: "You did it", body: "You reached today's call target. Well done." },
    standard: { title: "Daily target reached", body: "You hit today's call target." },
    direct: { title: "Target hit", body: "Today's call target is done." },
  },
  data_stale: {
    gentle: { title: "Quick check", body: "HighLevel activity hasn't synced in a bit — worth a quick look." },
    standard: { title: "Connection issue", body: "HighLevel activity hasn't synced recently. Check the connection." },
    direct: { title: "Connection issue", body: "HighLevel isn't syncing. Check the connection now." },
  },
};

export function buildInterventionCopy(state: BehavioralState, intensity: CoachingIntensity): InterventionCopy | null {
  const category = STATE_TO_CATEGORY[state.state];
  const copyByIntensity = COPY[state.state];
  if (!category || !copyByIntensity) return null;
  return { category, ...copyByIntensity[intensity] };
}
