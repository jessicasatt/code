import { describe, expect, it } from "vitest";
import {
  calculateCallsRemainingToday,
  calculateClientsNeeded,
  calculateElapsedFractionOfCallingHours,
  calculateExpectedCallsByNow,
  calculatePaceStatus,
  calculateRemainingMrr,
  calculateRequiredDailyPace,
  calculateWeeklyCallsRemaining,
} from "./revenue";
import { fromAppTime } from "../date/timezone";

describe("calculateRemainingMrr", () => {
  it("returns the gap between goal and current MRR", () => {
    expect(calculateRemainingMrr(1_000_000, 425_000)).toBe(575_000);
  });

  it("never returns negative when goal is already exceeded", () => {
    expect(calculateRemainingMrr(1_000_000, 1_500_000)).toBe(0);
  });
});

describe("calculateClientsNeeded", () => {
  it("rounds up to whole clients", () => {
    expect(calculateClientsNeeded(575_000, 125_000)).toBe(5); // 4.6 -> 5
  });

  it("returns 0 when there is no remaining gap", () => {
    expect(calculateClientsNeeded(0, 125_000)).toBe(0);
  });

  it("returns 0 rather than dividing by zero when average value is 0", () => {
    expect(calculateClientsNeeded(575_000, 0)).toBe(0);
  });
});

describe("calculateWeeklyCallsRemaining", () => {
  it("floors at 0 once the weekly target is met or exceeded", () => {
    expect(calculateWeeklyCallsRemaining(175, 200)).toBe(0);
    expect(calculateWeeklyCallsRemaining(175, 100)).toBe(75);
  });
});

describe("calculateRequiredDailyPace", () => {
  it("divides remaining calls across remaining workdays, rounding up", () => {
    expect(calculateRequiredDailyPace(75, 4)).toBe(19); // 18.75 -> 19
  });

  it("dumps all remaining calls into today when no workdays remain", () => {
    expect(calculateRequiredDailyPace(30, 0)).toBe(30);
  });

  it("returns 0 when nothing remains", () => {
    expect(calculateRequiredDailyPace(0, 3)).toBe(0);
  });
});

describe("calculateCallsRemainingToday", () => {
  it("floors at 0 once today's target is met", () => {
    expect(calculateCallsRemainingToday(40, 45)).toBe(0);
    expect(calculateCallsRemainingToday(40, 33)).toBe(7);
  });
});

describe("calculateElapsedFractionOfCallingHours", () => {
  it("is 0 before the window opens", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 8, 0)); // 8am, before 9-17 window
    expect(calculateElapsedFractionOfCallingHours(now, { start: "09:00", end: "17:00" })).toBe(0);
  });

  it("is 1 after the window closes", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 18, 0));
    expect(calculateElapsedFractionOfCallingHours(now, { start: "09:00", end: "17:00" })).toBe(1);
  });

  it("is the correct fraction mid-window", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 13, 0)); // 4h into an 8h window
    expect(calculateElapsedFractionOfCallingHours(now, { start: "09:00", end: "17:00" })).toBeCloseTo(0.5);
  });
});

describe("calculateExpectedCallsByNow", () => {
  it("scales the daily target by elapsed fraction", () => {
    expect(calculateExpectedCallsByNow(40, 0.5)).toBe(20);
  });
});

describe("calculatePaceStatus", () => {
  it("is behind when more than 1 call under expected", () => {
    expect(calculatePaceStatus(10, 12)).toBe("behind");
  });

  it("is ahead when more than 1 call over expected", () => {
    expect(calculatePaceStatus(14, 12)).toBe("ahead");
  });

  it("is on pace within the 1-call tolerance band", () => {
    expect(calculatePaceStatus(12, 12)).toBe("on_pace");
    expect(calculatePaceStatus(12.5, 12)).toBe("on_pace");
    expect(calculatePaceStatus(11.5, 12)).toBe("on_pace");
  });
});
