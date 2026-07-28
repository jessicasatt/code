import { describe, expect, it } from "vitest";
import { determineSuggestedBlockMode, estimateBlockMinutes, suggestBlockSize } from "./block-sizing";

describe("determineSuggestedBlockMode", () => {
  it("suggests a normal block with no prior activity today", () => {
    expect(determineSuggestedBlockMode(null)).toBe("normal");
  });

  it("suggests a restart after a block that ended without reaching its target", () => {
    expect(determineSuggestedBlockMode({ status: "cancelled", callTarget: 10, callsCompleted: 4 })).toBe("restart");
    expect(determineSuggestedBlockMode({ status: "completed", callTarget: 10, callsCompleted: 4 })).toBe("restart");
  });

  it("suggests recovery sizing after a successful 1-call restart", () => {
    expect(determineSuggestedBlockMode({ status: "completed", callTarget: 1, callsCompleted: 1 })).toBe("post_restart_recovery");
  });

  it("suggests high momentum after a fully completed normal-or-larger block", () => {
    expect(determineSuggestedBlockMode({ status: "completed", callTarget: 10, callsCompleted: 10 })).toBe("high_momentum");
    expect(determineSuggestedBlockMode({ status: "completed", callTarget: 4, callsCompleted: 4 })).toBe("high_momentum");
  });
});

describe("suggestBlockSize", () => {
  it("maps each mode to its configured size using defaults", () => {
    expect(suggestBlockSize("normal")).toBe(10);
    expect(suggestBlockSize("restart")).toBe(1);
    expect(suggestBlockSize("post_restart_recovery")).toBe(4);
    expect(suggestBlockSize("high_momentum")).toBe(10);
  });

  it("respects a custom config", () => {
    const config = { normalBlockSize: 8, restartBlockSize: 2, postRestartBlockSize: 5, highMomentumBlockSize: 12, nearCompletionThreshold: 2 };
    expect(suggestBlockSize("normal", config)).toBe(8);
    expect(suggestBlockSize("restart", config)).toBe(2);
    expect(suggestBlockSize("post_restart_recovery", config)).toBe(5);
    expect(suggestBlockSize("high_momentum", config)).toBe(12);
  });
});

describe("estimateBlockMinutes", () => {
  it("scales with call target", () => {
    expect(estimateBlockMinutes(10)).toBe(40);
    expect(estimateBlockMinutes(1)).toBe(5);
  });

  it("never estimates below a 5-minute floor", () => {
    expect(estimateBlockMinutes(1, 1)).toBe(5);
  });
});
