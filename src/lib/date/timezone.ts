import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  differenceInMinutes,
  isWithinInterval,
  isSameDay,
} from "date-fns";

/** The single owner's operating timezone. All scheduling and "today"/"this week" boundaries are computed against this, never the visiting browser's local time. */
export const APP_TIMEZONE = "America/Los_Angeles";

/** Current instant, exposed as a function so tests can inject a fixed `now`. */
export function nowUtc(): Date {
  return new Date();
}

/** Converts a UTC instant into the wall-clock Date components of APP_TIMEZONE. */
export function toAppTime(utcDate: Date): Date {
  return toZonedTime(utcDate, APP_TIMEZONE);
}

/** Converts wall-clock Date components (interpreted as APP_TIMEZONE) back into a UTC instant. */
export function fromAppTime(zonedDate: Date): Date {
  return fromZonedTime(zonedDate, APP_TIMEZONE);
}

export function startOfAppDay(utcDate: Date): Date {
  return fromAppTime(startOfDay(toAppTime(utcDate)));
}

export function endOfAppDay(utcDate: Date): Date {
  return fromAppTime(endOfDay(toAppTime(utcDate)));
}

/** Week starts Monday, matching a Mon-Fri/Sat sales workweek. */
export function startOfAppWeek(utcDate: Date): Date {
  return fromAppTime(startOfWeek(toAppTime(utcDate), { weekStartsOn: 1 }));
}

export function endOfAppWeek(utcDate: Date): Date {
  return fromAppTime(endOfWeek(toAppTime(utcDate), { weekStartsOn: 1 }));
}

export function isSameAppDay(a: Date, b: Date): boolean {
  return isSameDay(toAppTime(a), toAppTime(b));
}

export function formatAppTime(utcDate: Date, formatStr: string): string {
  return formatInTimeZone(utcDate, APP_TIMEZONE, formatStr);
}

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Counts remaining configured workdays in the current app-timezone week,
 * starting from `now` (inclusive of today if today is a workday).
 */
export function remainingWorkdaysInWeek(now: Date, workdays: string[]): number {
  const workdayIndices = new Set(workdays.map((d) => WEEKDAY_INDEX[d.toLowerCase()]).filter((n) => n !== undefined));
  const weekEnd = endOfAppWeek(now);
  const zonedNow = toAppTime(now);
  let count = 0;
  let cursor = startOfDay(zonedNow);
  const zonedWeekEnd = toAppTime(weekEnd);
  while (cursor <= zonedWeekEnd) {
    if (workdayIndices.has(cursor.getDay())) {
      count += 1;
    }
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** Minutes elapsed between two UTC instants (always >= 0 truncated toward zero for negative input). */
export function minutesBetween(later: Date, earlier: Date): number {
  return differenceInMinutes(later, earlier);
}

export interface TimeOfDayRange {
  /** "HH:mm" 24-hour, interpreted in APP_TIMEZONE */
  start: string;
  end: string;
}

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** Whether `instant` falls within a quiet-hours window, correctly handling windows that cross midnight. */
export function isWithinTimeRange(instant: Date, range: TimeOfDayRange): boolean {
  const zoned = toAppTime(instant);
  const minutesOfDay = zoned.getHours() * 60 + zoned.getMinutes();
  const start = timeStringToMinutes(range.start);
  const end = timeStringToMinutes(range.end);

  if (start === end) return false;
  if (start < end) {
    return minutesOfDay >= start && minutesOfDay < end;
  }
  // Crosses midnight, e.g. 22:00 - 07:00
  return minutesOfDay >= start || minutesOfDay < end;
}

export function isWithinInstantRange(instant: Date, start: Date, end: Date): boolean {
  return isWithinInterval(instant, { start, end });
}
