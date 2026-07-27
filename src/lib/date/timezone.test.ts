import { describe, expect, it } from "vitest";
import {
  endOfAppDay,
  formatAppTime,
  fromAppTime,
  isSameAppDay,
  isWithinTimeRange,
  minutesBetween,
  remainingWorkdaysInWeek,
  startOfAppDay,
  startOfAppWeek,
  toAppTime,
} from "./timezone";

describe("startOfAppDay / endOfAppDay", () => {
  it("brackets a UTC instant to the LA calendar day it falls in", () => {
    // 2026-01-15 03:00 UTC is still 2026-01-14 19:00 in Los Angeles (PST, UTC-8)
    const instant = new Date(Date.UTC(2026, 0, 15, 3, 0));
    const start = startOfAppDay(instant);
    const end = endOfAppDay(instant);

    expect(formatAppTime(start, "yyyy-MM-dd HH:mm:ss")).toBe("2026-01-14 00:00:00");
    expect(formatAppTime(end, "yyyy-MM-dd HH:mm:ss")).toBe("2026-01-14 23:59:59");
  });
});

describe("DST boundary", () => {
  it("handles the spring-forward transition (2026-03-08 in America/Los_Angeles)", () => {
    // Before DST: PST is UTC-8. After: PDT is UTC-7.
    const beforeDst = fromAppTime(new Date(2026, 2, 8, 1, 0)); // 01:00 LA time, still PST
    const afterDst = fromAppTime(new Date(2026, 2, 8, 3, 0)); // 03:00 LA time, now PDT

    expect(formatAppTime(beforeDst, "HH:mm XXX")).toBe("01:00 -08:00");
    expect(formatAppTime(afterDst, "HH:mm XXX")).toBe("03:00 -07:00");
  });
});

describe("startOfAppWeek", () => {
  it("starts the week on Monday", () => {
    const wednesday = fromAppTime(new Date(2026, 0, 14, 12, 0)); // Jan 14 2026 is a Wednesday
    const weekStart = startOfAppWeek(wednesday);
    expect(formatAppTime(weekStart, "yyyy-MM-dd EEEE")).toBe("2026-01-12 Monday");
  });
});

describe("isSameAppDay", () => {
  it("treats two instants on either side of UTC midnight as the same LA day when appropriate", () => {
    const late = new Date(Date.UTC(2026, 0, 15, 23, 0)); // 2026-01-15 15:00 LA (PST)
    const early = new Date(Date.UTC(2026, 0, 16, 3, 0)); // 2026-01-15 19:00 LA (PST) - still same LA day
    expect(isSameAppDay(late, early)).toBe(true);

    const nextDay = new Date(Date.UTC(2026, 0, 16, 9, 0)); // 2026-01-16 01:00 LA - different LA day
    expect(isSameAppDay(late, nextDay)).toBe(false);
  });
});

describe("remainingWorkdaysInWeek", () => {
  it("counts today and remaining configured workdays through week end", () => {
    const wednesday = fromAppTime(new Date(2026, 0, 14, 9, 0));
    const workdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    // Wed, Thu, Fri remain = 3
    expect(remainingWorkdaysInWeek(wednesday, workdays)).toBe(3);
  });

  it("returns 0 on a non-workday with no workdays left in the week", () => {
    const saturday = fromAppTime(new Date(2026, 0, 17, 9, 0));
    const workdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    expect(remainingWorkdaysInWeek(saturday, workdays)).toBe(0);
  });
});

describe("minutesBetween", () => {
  it("computes whole minutes elapsed", () => {
    const earlier = new Date(Date.UTC(2026, 0, 15, 10, 0));
    const later = new Date(Date.UTC(2026, 0, 15, 10, 27));
    expect(minutesBetween(later, earlier)).toBe(27);
  });
});

describe("isWithinTimeRange", () => {
  it("handles a same-day window", () => {
    const instant = fromAppTime(new Date(2026, 0, 15, 12, 0));
    expect(isWithinTimeRange(instant, { start: "09:00", end: "17:00" })).toBe(true);
    expect(isWithinTimeRange(fromAppTime(new Date(2026, 0, 15, 18, 0)), { start: "09:00", end: "17:00" })).toBe(false);
  });

  it("handles a window that crosses midnight (quiet hours)", () => {
    const lateNight = fromAppTime(new Date(2026, 0, 15, 23, 0));
    const earlyMorning = fromAppTime(new Date(2026, 0, 15, 5, 0));
    const midday = fromAppTime(new Date(2026, 0, 15, 12, 0));
    const range = { start: "20:00", end: "07:00" };

    expect(isWithinTimeRange(lateNight, range)).toBe(true);
    expect(isWithinTimeRange(earlyMorning, range)).toBe(true);
    expect(isWithinTimeRange(midday, range)).toBe(false);
  });
});

describe("toAppTime", () => {
  it("round-trips through fromAppTime", () => {
    const original = fromAppTime(new Date(2026, 5, 1, 14, 30));
    const zoned = toAppTime(original);
    expect(zoned.getHours()).toBe(14);
    expect(zoned.getMinutes()).toBe(30);
  });
});
