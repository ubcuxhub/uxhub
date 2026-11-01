/**
 * UX Hub events are scheduled in Vancouver. These helpers pin displays and
 * form conversions to Pacific time instead of the viewer's browser timezone.
 *
 * They never ask `Intl` (or the runtime's tz database) about Vancouver. The
 * Pacific offset is worked out below from the rule itself, and every string is
 * built by hand from fixed English names, so the server and every browser give
 * the same text for the same instant: no hydration mismatches, and no hour
 * shift for a viewer whose device has older tz data. See `pacificOffset`.
 */
import { formatTimeInput, type WallTime } from "@/lib/date-input";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PST = -8 * HOUR_MS;
const PDT = -7 * HOUR_MS;

/**
 * 2:00 AM PST on Sunday, March 8, 2026: BC's last change of clocks. British
 * Columbia stays on UTC-7 from then on, with no fall back on November 1, 2026
 * (IANA tzdata 2026c). Browsers and servers with older tz data would still put
 * Vancouver on UTC-8 that winter, which is why this rule is pinned here.
 */
const PERMANENT_PDT_FROM = Date.UTC(2026, 2, 8, 10);

/** Midnight UTC on the `n`th Sunday of a month (`monthIndex` is 0-based). */
function nthSunday(year: number, monthIndex: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return Date.UTC(year, monthIndex, 1 + ((7 - firstWeekday) % 7) + (n - 1) * 7);
}

/**
 * Vancouver's offset from UTC, in milliseconds, at an instant. Until March 8,
 * 2026 it follows the North American rule in force since 2007: UTC-7 from
 * 2:00 AM on the second Sunday of March to 2:00 AM on the first Sunday of
 * November, UTC-8 otherwise. From then on it is UTC-7 all year. No UX Hub data
 * predates 2007, so the older rules aren't modelled.
 */
function pacificOffset(instant: number): number {
  if (instant >= PERMANENT_PDT_FROM) return PDT;
  const year = new Date(instant).getUTCFullYear();
  const dstStart = nthSunday(year, 2, 2) + 2 * HOUR_MS - PST;
  const dstEnd = nthSunday(year, 10, 1) + 2 * HOUR_MS - PDT;
  return instant >= dstStart && instant < dstEnd ? PDT : PST;
}

/** An instant's Vancouver wall clock. */
interface PacificWall {
  instant: number;
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 is Sunday. */
  weekday: number;
  /** `YYYY-MM-DD`, for comparing calendar days. */
  isoDay: string;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function toPacificWall(instant: number): PacificWall {
  const wall = new Date(instant + pacificOffset(instant));
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth() + 1;
  const day = wall.getUTCDate();
  return {
    instant,
    year,
    month,
    day,
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
    second: wall.getUTCSeconds(),
    weekday: wall.getUTCDay(),
    isoDay: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
  };
}

function parseDate(value: string): Date | null {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pacificWall(value: string | null | undefined): PacificWall | null {
  if (!value) return null;
  const date = parseDate(value);
  return date ? toPacificWall(date.getTime()) : null;
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((name) => name.slice(0, 3));
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAYS_SHORT = WEEKDAYS_LONG.map((name) => name.slice(0, 3));

/** "7:00 PM" (§2.9), with a plain space. */
function clockTime(wall: Pick<PacificWall, "hour" | "minute">): string {
  return formatTimeInput(`${pad(wall.hour)}:${pad(wall.minute)}` as WallTime);
}

/** The fields `formatEventDate` can show. Set one to `undefined` to drop it. */
export interface EventDateOptions {
  weekday?: "long" | "short";
  month?: "long" | "short";
  day?: "numeric";
  year?: "numeric";
}

/**
 * A Pacific calendar date: "July 4, 2026" by default; "Jul 4, 2026" with
 * `{ month: "short" }`; "Saturday, July 4, 2026" with `{ weekday: "long" }`;
 * "July 2026" with `{ day: undefined }`; "Sat, Jul 4" with
 * `{ weekday: "short", month: "short", year: undefined }`.
 */
export function formatEventDate(
  value: string | null | undefined,
  options: EventDateOptions = {}
): string | null {
  if (!value) return null;
  const wall = pacificWall(value);
  if (!wall) return value;

  const { weekday, month, day, year }: EventDateOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  };
  const monthName = month
    ? (month === "long" ? MONTHS_LONG : MONTHS_SHORT)[wall.month - 1]
    : null;

  if (!day) return [monthName, year ? wall.year : null].filter(Boolean).join(" ");

  const monthDay = monthName ? `${monthName} ${wall.day}` : String(wall.day);
  return [
    weekday
      ? (weekday === "long" ? WEEKDAYS_LONG : WEEKDAYS_SHORT)[wall.weekday]
      : null,
    monthDay,
    year ? String(wall.year) : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * "7:00 PM", in Pacific time for a timestamp. A bare clock time ("19:00", from
 * an agenda row) is formatted as it is.
 */
export function formatEventTime(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  if (!value.includes("T")) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return value;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return value;
    return clockTime({ hour, minute });
  }

  const wall = pacificWall(value);
  return wall ? clockTime(wall) : value;
}

/** "Jul 14, 2026, 7:30 PM", in Pacific time. */
export function formatTimestamp(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const wall = pacificWall(value);
  if (!wall) return value;
  return `${MONTHS_SHORT[wall.month - 1]} ${wall.day}, ${wall.year}, ${clockTime(wall)}`;
}

export function timestamptzToDatetimeLocal(
  value: string | null | undefined
): string {
  const wall = pacificWall(value);
  if (!wall) return "";
  return `${wall.isoDay}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** The Pacific calendar day (`YYYY-MM-DD`) an instant falls on. */
export function pacificDate(value: string | null | undefined): string {
  return pacificWall(value)?.isoDay ?? "";
}

/**
 * Reads a `YYYY-MM-DDTHH:mm` value as Vancouver wall-clock time. A time the
 * clocks skip (2:30 AM on a spring-forward day) is read with the standard
 * offset, so it lands an hour later; a time that happens twice takes the first.
 */
export function datetimeLocalToTimestamptz(value: string): string | null {
  if (!value) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const wallAsUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
  for (const offset of [PDT, PST]) {
    const instant = wallAsUtc - offset;
    if (pacificOffset(instant) === offset) return new Date(instant).toISOString();
  }
  return new Date(wallAsUtc - PST).toISOString();
}

/**
 * An end by this time (6:00 AM) on the morning after the start day belongs to
 * the start day: 7:00 PM to midnight, or a social that runs to 1:00 AM, is a
 * one-day event.
 */
const OVERNIGHT_END_MINUTES = 6 * 60;

function nextIsoDay(isoDay: string): string {
  const next = new Date(Date.parse(`${isoDay}T00:00:00Z`) + DAY_MS);
  return next.toISOString().slice(0, 10);
}

/** Whether an event that runs to `to` belongs to the start day alone. */
function endsSameDay(from: PacificWall, to: PacificWall): boolean {
  if (to.isoDay <= from.isoDay) return true;
  return (
    to.isoDay === nextIsoDay(from.isoDay) &&
    to.hour * 60 + to.minute <= OVERNIGHT_END_MINUTES &&
    to.instant - from.instant < DAY_MS
  );
}

/** The end, or null when there's none or it isn't after the start. */
function endAfter(from: PacificWall, end: string | null | undefined) {
  const to = pacificWall(end);
  return to && to.instant > from.instant ? to : null;
}

/**
 * Whether an event's schedule spans more than one Pacific day. An end at or
 * before 6:00 AM the next morning (midnight, say) still counts as the start
 * day, so a 7:00 PM to 12:00 AM event is one day.
 */
export function endsOnLaterDay(
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  const from = pacificWall(start);
  if (!from) return false;
  const to = endAfter(from, end);
  return !!to && !endsSameDay(from, to);
}

/**
 * The short date a timeline row is labelled with, in Pacific time: "Jan 9",
 * "Jan 9–10", "Jan 30–Feb 2", and "Dec 30, 2026–Jan 2, 2027" across a year.
 * Falls back to the start alone when there is no end, or it is the same day
 * (see `endsOnLaterDay`).
 */
export function formatEventDateLabel(
  start: string | null | undefined,
  end?: string | null
): string | null {
  const from = pacificWall(start);
  if (!from) return null;
  const fromMonth = MONTHS_SHORT[from.month - 1];
  const to = endAfter(from, end);
  if (!to || endsSameDay(from, to)) return `${fromMonth} ${from.day}`;

  const toMonth = MONTHS_SHORT[to.month - 1];
  if (to.year !== from.year) {
    return `${fromMonth} ${from.day}, ${from.year}–${toMonth} ${to.day}, ${to.year}`;
  }
  if (to.month !== from.month) {
    return `${fromMonth} ${from.day}–${toMonth} ${to.day}`;
  }
  return `${fromMonth} ${from.day}–${to.day}`;
}

/** One line of an event's schedule: the day ("Sat, Jan 9") and its time. */
export interface EventDateLine {
  day: string;
  time: string;
}

const dayLine = (wall: PacificWall) =>
  `${WEEKDAYS_SHORT[wall.weekday]}, ${MONTHS_SHORT[wall.month - 1]} ${wall.day}`;

/**
 * The schedule split into display lines, in Pacific time. A same-day event is
 * one line with a time range ("9:00 AM–7:00 PM", or "7:00 PM–12:00 AM" for one
 * that runs to midnight); a multi-day event is two lines, the start day with
 * its start time and the end day with its end time.
 */
export function formatEventDateTimeLines(
  start: string | null | undefined,
  end?: string | null
): EventDateLine[] {
  const from = pacificWall(start);
  if (!from) return [];
  const to = endAfter(from, end);

  if (!to) return [{ day: dayLine(from), time: clockTime(from) }];
  if (endsSameDay(from, to)) {
    return [{ day: dayLine(from), time: `${clockTime(from)}–${clockTime(to)}` }];
  }
  return [
    { day: dayLine(from), time: clockTime(from) },
    { day: dayLine(to), time: clockTime(to) },
  ];
}

/**
 * The schedule as one string: "Sat, Jan 9 9:00 AM–7:00 PM", or across days
 * "Sat, Jan 9 9:00 AM – Sun, Jan 10 3:00 PM". Times are Pacific.
 */
export function formatEventDateTimeRange(
  start: string | null | undefined,
  end?: string | null
): string | null {
  const lines = formatEventDateTimeLines(start, end);
  if (lines.length === 0) return null;
  return lines.map((line) => `${line.day} ${line.time}`).join(" – ");
}
