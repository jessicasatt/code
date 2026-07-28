import { describe, expect, it } from "vitest";
import { canSendInactivityNudge, isCurrentHourMatch, isInactiveDuringActiveBlock, isNotificationEligible } from "./notifications";
import { fromAppTime } from "../date/timezone";

describe("isInactiveDuringActiveBlock", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("is false when the block is not active", () => {
    expect(
      isInactiveDuringActiveBlock({
        blockStatus: "scheduled",
        lastActivityAt: new Date("2026-01-15T11:00:00Z"),
        now,
      }),
    ).toBe(false);
  });

  it("is false when the inactivity gap is under the threshold", () => {
    expect(
      isInactiveDuringActiveBlock({
        blockStatus: "active",
        lastActivityAt: new Date("2026-01-15T11:50:00Z"), // 10 min ago
        now,
      }),
    ).toBe(false);
  });

  it("is true once the gap reaches the 25-minute threshold during an active block", () => {
    expect(
      isInactiveDuringActiveBlock({
        blockStatus: "active",
        lastActivityAt: new Date("2026-01-15T11:35:00Z"), // 25 min ago
        now,
      }),
    ).toBe(true);
  });

  it("never fires with no recorded activity yet", () => {
    expect(isInactiveDuringActiveBlock({ blockStatus: "active", lastActivityAt: null, now })).toBe(false);
  });
});

describe("canSendInactivityNudge", () => {
  it("allows the first nudge with no prior send", () => {
    expect(canSendInactivityNudge({ lastNudgeSentAt: null, now: new Date() })).toBe(true);
  });

  it("blocks a second nudge inside the 45-minute cooldown", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const lastNudgeSentAt = new Date("2026-01-15T11:30:00Z"); // 30 min ago
    expect(canSendInactivityNudge({ lastNudgeSentAt, now })).toBe(false);
  });

  it("allows another nudge once the cooldown has fully elapsed", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const lastNudgeSentAt = new Date("2026-01-15T11:15:00Z"); // 45 min ago
    expect(canSendInactivityNudge({ lastNudgeSentAt, now })).toBe(true);
  });
});

describe("isNotificationEligible", () => {
  it("is false when the category is disabled, even outside quiet hours", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 12, 0));
    expect(
      isNotificationEligible({
        category: "inactivity",
        categoryEnabled: false,
        now,
        quietHours: { start: "20:00", end: "07:00" },
      }),
    ).toBe(false);
  });

  it("is false during quiet hours even when enabled", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 22, 0));
    expect(
      isNotificationEligible({
        category: "inactivity",
        categoryEnabled: true,
        now,
        quietHours: { start: "20:00", end: "07:00" },
      }),
    ).toBe(false);
  });

  it("is true when enabled and outside quiet hours", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 12, 0));
    expect(
      isNotificationEligible({
        category: "inactivity",
        categoryEnabled: true,
        now,
        quietHours: { start: "20:00", end: "07:00" },
      }),
    ).toBe(true);
  });
});

describe("isCurrentHourMatch", () => {
  it("matches when the app-timezone hour equals the configured hour, ignoring minutes", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 7, 42));
    expect(isCurrentHourMatch(now, "07:30")).toBe(true);
    expect(isCurrentHourMatch(now, "07:00")).toBe(true);
  });

  it("does not match a different hour", () => {
    const now = fromAppTime(new Date(2026, 0, 15, 7, 42));
    expect(isCurrentHourMatch(now, "08:00")).toBe(false);
    expect(isCurrentHourMatch(now, "18:00")).toBe(false);
  });
});
