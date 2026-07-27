import { describe, expect, it } from "vitest";
import { buildNextAction } from "./next-action";

describe("buildNextAction", () => {
  const now = new Date("2026-01-15T18:00:00Z");

  it("prioritizes finishing an active block", () => {
    const action = buildNextAction({
      now,
      callsRemainingToday: 10,
      activeWorkBlock: { callsRemaining: 3, plannedEnd: "2026-01-15T19:30:00Z" },
      followUpsDue: 2,
    });
    expect(action.kind).toBe("finish_active_block");
    expect(action.message).toContain("Complete 3 more calls before");
  });

  it("uses singular phrasing for exactly one call remaining", () => {
    const action = buildNextAction({
      now,
      callsRemainingToday: 10,
      activeWorkBlock: { callsRemaining: 1, plannedEnd: "2026-01-15T19:30:00Z" },
      followUpsDue: 0,
    });
    expect(action.message).toContain("Complete 1 more call before");
  });

  it("suggests starting a block when none is active and calls remain", () => {
    const action = buildNextAction({ now, callsRemainingToday: 7, activeWorkBlock: null, followUpsDue: 0 });
    expect(action.kind).toBe("start_block");
    expect(action.message).toBe("Start a call block and complete 7 more calls today.");
  });

  it("surfaces follow-ups once the daily call target is met", () => {
    const action = buildNextAction({ now, callsRemainingToday: 0, activeWorkBlock: null, followUpsDue: 2 });
    expect(action.kind).toBe("follow_up");
    expect(action.message).toBe("Complete 2 follow-ups due today.");
  });

  it("confirms the target is met when there is nothing else to do", () => {
    const action = buildNextAction({ now, callsRemainingToday: 0, activeWorkBlock: null, followUpsDue: 0 });
    expect(action.kind).toBe("target_met");
  });
});
