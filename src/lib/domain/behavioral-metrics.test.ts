import { describe, expect, it } from "vitest";
import {
  computeActivationMinutes,
  computeBlockCompletionRate,
  computeCallRateAfterOutcome,
  computeInterventionEffectiveness,
  computeRecoveryRate,
  computeRestartMinutes,
  resolveCheckinResumption,
  summarizeInterruptionReasons,
} from "./behavioral-metrics";

describe("computeActivationMinutes", () => {
  it("returns null when no call has happened yet", () => {
    expect(computeActivationMinutes({ blockStartedAt: "2026-07-28T10:00:00Z", firstCallAt: null })).toBeNull();
  });

  it("returns minutes between block start and first call", () => {
    expect(
      computeActivationMinutes({ blockStartedAt: "2026-07-28T10:00:00Z", firstCallAt: "2026-07-28T10:04:00Z" }),
    ).toBe(4);
  });
});

describe("computeRestartMinutes", () => {
  it("returns null when no call followed the check-in", () => {
    expect(computeRestartMinutes({ checkinAt: "2026-07-28T10:00:00Z", nextCallAt: null })).toBeNull();
  });

  it("returns minutes between check-in and next call", () => {
    expect(computeRestartMinutes({ checkinAt: "2026-07-28T10:00:00Z", nextCallAt: "2026-07-28T10:02:00Z" })).toBe(2);
  });
});

describe("computeRecoveryRate", () => {
  it("returns null with no samples", () => {
    expect(computeRecoveryRate([])).toBeNull();
  });

  it("computes fraction resumed with sample size", () => {
    expect(computeRecoveryRate([{ resumed: true }, { resumed: true }, { resumed: false }, { resumed: true }])).toEqual({
      rate: 0.75,
      sampleSize: 4,
    });
  });
});

describe("computeBlockCompletionRate", () => {
  it("returns null with no blocks", () => {
    expect(computeBlockCompletionRate([])).toBeNull();
  });

  it("counts only blocks that reached their full target", () => {
    const blocks = [
      { status: "completed" as const, callsCompleted: 10, callTarget: 10 },
      { status: "completed" as const, callsCompleted: 4, callTarget: 10 },
      { status: "cancelled" as const, callsCompleted: 2, callTarget: 10 },
    ];
    expect(computeBlockCompletionRate(blocks)).toEqual({ rate: 1 / 3, sampleSize: 3 });
  });
});

describe("summarizeInterruptionReasons", () => {
  it("counts reasons and sorts most common first", () => {
    const checkins = [
      { reason: "distracted" as const },
      { reason: "rejection" as const },
      { reason: "distracted" as const },
    ];
    expect(summarizeInterruptionReasons(checkins)).toEqual([
      { reason: "distracted", count: 2 },
      { reason: "rejection", count: 1 },
    ]);
  });
});

describe("computeInterventionEffectiveness", () => {
  it("returns zero sample size when nothing is resolved yet", () => {
    expect(
      computeInterventionEffectiveness([{ resumedWithin10Min: null, resumedWithin30Min: null, resumedWithin60Min: null }]),
    ).toEqual({ sampleSize: 0, resumedWithin10MinRate: null, resumedWithin30MinRate: null, resumedWithin60MinRate: null });
  });

  it("computes rates only over resolved samples", () => {
    const samples = [
      { resumedWithin10Min: true, resumedWithin30Min: true, resumedWithin60Min: true },
      { resumedWithin10Min: false, resumedWithin30Min: true, resumedWithin60Min: true },
      { resumedWithin10Min: null, resumedWithin30Min: null, resumedWithin60Min: null },
    ];
    expect(computeInterventionEffectiveness(samples)).toEqual({
      sampleSize: 2,
      resumedWithin10MinRate: 0.5,
      resumedWithin30MinRate: 1,
      resumedWithin60MinRate: 1,
    });
  });
});

describe("computeCallRateAfterOutcome", () => {
  it("returns null when the outcome never occurred", () => {
    expect(computeCallRateAfterOutcome([{ answeredStatus: "answered", nextCallHappened: true }], "no_answer")).toBeNull();
  });

  it("computes continuation rate filtered to the given outcome", () => {
    const samples = [
      { answeredStatus: "no_answer" as const, nextCallHappened: true },
      { answeredStatus: "no_answer" as const, nextCallHappened: false },
      { answeredStatus: "answered" as const, nextCallHappened: true },
    ];
    expect(computeCallRateAfterOutcome(samples, "no_answer")).toEqual({ rate: 0.5, sampleSize: 2 });
  });
});

describe("resolveCheckinResumption", () => {
  it("marks all three windows true for a very fast resumption", () => {
    expect(resolveCheckinResumption(new Date("2026-07-28T10:00:00Z"), new Date("2026-07-28T10:05:00Z"))).toEqual({
      resumedWithin10Min: true,
      resumedWithin30Min: true,
      resumedWithin60Min: true,
    });
  });

  it("marks only the wider windows true for a slower resumption", () => {
    expect(resolveCheckinResumption(new Date("2026-07-28T10:00:00Z"), new Date("2026-07-28T10:45:00Z"))).toEqual({
      resumedWithin10Min: false,
      resumedWithin30Min: false,
      resumedWithin60Min: true,
    });
  });

  it("marks all false when no window is met", () => {
    expect(resolveCheckinResumption(new Date("2026-07-28T10:00:00Z"), new Date("2026-07-28T12:00:00Z"))).toEqual({
      resumedWithin10Min: false,
      resumedWithin30Min: false,
      resumedWithin60Min: false,
    });
  });
});
