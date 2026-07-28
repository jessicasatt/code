import { describe, expect, it } from "vitest";
import { buildInterventionCopy } from "./intervention-copy";
import type { BehavioralState } from "./behavioral-state";

function state(overrides: Partial<BehavioralState>): BehavioralState {
  return {
    state: "late_start",
    severity: "medium",
    reason: "test",
    recommendedPlaybook: "prompt_first_call",
    eligibleForNotification: true,
    nextEvaluationAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildInterventionCopy", () => {
  it("maps a covered state to its category and varies copy by intensity", () => {
    const gentle = buildInterventionCopy(state({ state: "late_start" }), "gentle");
    const direct = buildInterventionCopy(state({ state: "late_start" }), "direct");
    expect(gentle?.category).toBe("late_start");
    expect(direct?.category).toBe("late_start");
    expect(gentle?.body).not.toBe(direct?.body);
  });

  it("returns null for states already handled by existing event-driven notifications", () => {
    expect(buildInterventionCopy(state({ state: "block_nearly_complete" }), "standard")).toBeNull();
    expect(buildInterventionCopy(state({ state: "block_complete" }), "standard")).toBeNull();
  });

  it("returns null for states that should never notify", () => {
    expect(buildInterventionCopy(state({ state: "active_block" }), "standard")).toBeNull();
    expect(buildInterventionCopy(state({ state: "coaching_paused" }), "standard")).toBeNull();
    expect(buildInterventionCopy(state({ state: "outside_work_hours" }), "standard")).toBeNull();
  });

  it("covers every notification-eligible state with copy for all three intensities", () => {
    const coveredStates: BehavioralState["state"][] = ["late_start", "behind_pace", "inactive_mid_block", "daily_target_complete", "data_stale"];
    for (const s of coveredStates) {
      for (const intensity of ["gentle", "standard", "direct"] as const) {
        const copy = buildInterventionCopy(state({ state: s }), intensity);
        expect(copy).not.toBeNull();
        expect(copy?.title.length).toBeGreaterThan(0);
        expect(copy?.body.length).toBeGreaterThan(0);
      }
    }
  });
});
