import { describe, expect, it } from "vitest";
import {
  determineBehavioralState,
  type BehavioralStateSchedule,
  type DetermineBehavioralStateInput,
} from "./behavioral-state";

const BASE_SCHEDULE: BehavioralStateSchedule = {
  workdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  callingHoursStart: "09:00",
  callingHoursEnd: "17:00",
  desiredFirstCallTime: "09:00",
};

// 2026-01-15 is a Thursday; January is PST (UTC-8), no DST to worry about.
function laTime(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 0, 15, hour + 8, minute));
}

function baseInput(overrides: Partial<DetermineBehavioralStateInput> = {}): DetermineBehavioralStateInput {
  return {
    now: laTime(10, 0),
    timezone: "America/Los_Angeles",
    schedule: { ...BASE_SCHEDULE, workdays: [...BASE_SCHEDULE.workdays] },
    callsToday: 0,
    activeBlock: null,
    lastCallAt: null,
    firstCallAt: null,
    dailyTarget: 10,
    completedBlocks: [],
    coachingPaused: false,
    syncStatus: { connected: true, lastSyncedAt: laTime(9, 55), error: null },
    ...overrides,
  };
}

describe("determineBehavioralState", () => {
  it("coaching_paused overrides every other signal", () => {
    const result = determineBehavioralState(baseInput({ coachingPaused: true, now: laTime(3, 0) }));
    expect(result.state).toBe("coaching_paused");
    expect(result.eligibleForNotification).toBe(false);
  });

  it("outside_work_hours on a non-workday (Saturday)", () => {
    const saturday = new Date(Date.UTC(2026, 0, 17, 18, 0)); // Sat Jan 17, 10:00 LA
    const result = determineBehavioralState(baseInput({ now: saturday }));
    expect(result.state).toBe("outside_work_hours");
    expect(result.reason).toMatch(/scheduled calling day/);
  });

  it("outside_work_hours before calling hours open on a workday", () => {
    const result = determineBehavioralState(baseInput({ now: laTime(7, 0) }));
    expect(result.state).toBe("outside_work_hours");
    expect(result.reason).toMatch(/calling hours/);
  });

  it("data_stale when an active block's sync has an error", () => {
    const result = determineBehavioralState(
      baseInput({
        activeBlock: { status: "active", callTarget: 10, callsCompleted: 2 },
        lastCallAt: laTime(9, 58),
        syncStatus: { connected: false, lastSyncedAt: laTime(9, 30), error: "HighLevel token expired" },
      }),
    );
    expect(result.state).toBe("data_stale");
    expect(result.recommendedPlaybook).toBe("check_highlevel_connection");
  });

  it("block_complete once the active block's target is reached", () => {
    const result = determineBehavioralState(
      baseInput({ activeBlock: { status: "active", callTarget: 10, callsCompleted: 10 }, lastCallAt: laTime(9, 58) }),
    );
    expect(result.state).toBe("block_complete");
  });

  it("inactive_mid_block once the inactivity threshold is crossed, escalating severity", () => {
    const medium = determineBehavioralState(
      baseInput({
        now: laTime(10, 30),
        activeBlock: { status: "active", callTarget: 10, callsCompleted: 3 },
        lastCallAt: laTime(10, 0), // 30 min ago, threshold 25
        syncStatus: { connected: true, lastSyncedAt: laTime(10, 29), error: null },
      }),
    );
    expect(medium.state).toBe("inactive_mid_block");
    expect(medium.severity).toBe("medium");

    const high = determineBehavioralState(
      baseInput({
        now: laTime(11, 0),
        activeBlock: { status: "active", callTarget: 10, callsCompleted: 3 },
        lastCallAt: laTime(10, 0), // 60 min ago, >= 2x threshold
        syncStatus: { connected: true, lastSyncedAt: laTime(10, 59), error: null },
      }),
    );
    expect(high.state).toBe("inactive_mid_block");
    expect(high.severity).toBe("high");
  });

  it("block_nearly_complete when few calls remain and activity is recent", () => {
    const result = determineBehavioralState(
      baseInput({
        activeBlock: { status: "active", callTarget: 10, callsCompleted: 8 },
        lastCallAt: laTime(9, 58),
      }),
    );
    expect(result.state).toBe("block_nearly_complete");
    expect(result.reason).toMatch(/2 calls remaining/);
  });

  it("active_block when progress is nominal", () => {
    const result = determineBehavioralState(
      baseInput({
        activeBlock: { status: "active", callTarget: 10, callsCompleted: 4 },
        lastCallAt: laTime(9, 58),
      }),
    );
    expect(result.state).toBe("active_block");
    expect(result.eligibleForNotification).toBe(false);
  });

  it("daily_target_complete once today's target is reached with no active block", () => {
    const result = determineBehavioralState(baseInput({ callsToday: 10, dailyTarget: 10 }));
    expect(result.state).toBe("daily_target_complete");
  });

  it("recently_restarted right after a successful one-call restart block", () => {
    const result = determineBehavioralState(
      baseInput({
        callsToday: 1,
        completedBlocks: [{ status: "completed", callTarget: 1, callsCompleted: 1 }],
      }),
    );
    expect(result.state).toBe("recently_restarted");
    expect(result.eligibleForNotification).toBe(false);
  });

  it("not_started before the desired first-call time", () => {
    const result = determineBehavioralState(
      baseInput({
        now: laTime(9, 15),
        schedule: { ...BASE_SCHEDULE, desiredFirstCallTime: "09:30" },
      }),
    );
    expect(result.state).toBe("not_started");
    expect(result.eligibleForNotification).toBe(false);
  });

  it("late_start after the desired first-call time, severity scaling with lateness", () => {
    const low = determineBehavioralState(baseInput({ now: laTime(9, 10) }));
    expect(low.state).toBe("late_start");
    expect(low.severity).toBe("low");

    const medium = determineBehavioralState(baseInput({ now: laTime(9, 45) }));
    expect(medium.severity).toBe("medium");

    const high = determineBehavioralState(baseInput({ now: laTime(11, 0) }));
    expect(high.severity).toBe("high");
  });

  it("behind_pace when today's calls fall meaningfully short of the expected-by-now benchmark", () => {
    // 09:00-17:00 window, now 13:00 -> 50% elapsed -> expected 5 of 10.
    const result = determineBehavioralState(baseInput({ now: laTime(13, 0), callsToday: 2, dailyTarget: 10 }));
    expect(result.state).toBe("behind_pace");
    expect(result.recommendedPlaybook).toBe("suggest_smaller_block");
  });

  it("on_track_between_blocks when no block is active but pace is fine", () => {
    const result = determineBehavioralState(baseInput({ now: laTime(13, 0), callsToday: 5, dailyTarget: 10 }));
    expect(result.state).toBe("on_track_between_blocks");
    expect(result.eligibleForNotification).toBe(false);
  });

  it("always returns a nextEvaluationAt strictly after now", () => {
    const now = laTime(10, 0);
    const result = determineBehavioralState(baseInput({ now }));
    expect(new Date(result.nextEvaluationAt).getTime()).toBeGreaterThan(now.getTime());
  });
});
