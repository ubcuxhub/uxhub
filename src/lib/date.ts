/**
 * UX Hub events are scheduled in Vancouver. These helpers pin displays and
 * form conversions to Pacific time instead of the viewer's browser timezone.
 */
const PACIFIC_TIME_ZONE = "America/Vancouver";

function parseDate(value: string): Date | null {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEventDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string | null {
  if (!value) return null;
  const date = parseDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: PACIFIC_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatEventTime(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  if (!value.includes("T")) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return value;
    const hour = Number(match[1]);
    if (hour > 23) return value;
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "p.m." : "a.m."}`;
  }

  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC_TIME_ZONE,
  }).format(date);
}

export function formatTimestamp(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PACIFIC_TIME_ZONE,
  }).format(date);
}

function pacificParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function timestamptzToDatetimeLocal(
  value: string | null | undefined
): string {
  if (!value) return "";
  const date = parseDate(value);
  if (!date) return "";
  const parts = pacificParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The Pacific calendar day (`YYYY-MM-DD`) an instant falls on. */
export function pacificDate(value: string | null | undefined): string {
  return timestamptzToDatetimeLocal(value).slice(0, 10);
}

export function datetimeLocalToTimestamptz(value: string): string | null {
  if (!value) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const desiredUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
  let instant = desiredUtc;

  for (let pass = 0; pass < 2; pass += 1) {
    const parts = pacificParts(new Date(instant));
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    instant += desiredUtc - representedUtc;
  }

  return new Date(instant).toISOString();
}

const ENGLISH = "en-US";

interface PacificCalendar {
  year: string;
  month: string;
  weekday: string;
  day: string;
  time: string;
  /** `YYYY-MM-DD`, for comparing calendar days. */
  isoDay: string;
}

function pacificCalendar(value: string | null | undefined): PacificCalendar | null {
  if (!value) return null;
  const date = parseDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat(ENGLISH, {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "short",
    weekday: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    weekday: get("weekday"),
    day: get("day"),
    // ICU puts a narrow no-break space before AM/PM; the design uses a plain one.
    time: `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`,
    isoDay: pacificDate(value),
  };
}

/**
 * The short date a timeline row is labelled with, in Pacific time: "Jan 9",
 * "Jan 9–10", "Jan 30–Feb 2", and "Dec 30, 2026–Jan 2, 2027" across a year.
 * Falls back to the start alone when there is no end, or it is the same day.
 */
export function formatEventDateLabel(
  start: string | null | undefined,
  end?: string | null
): string | null {
  const from = pacificCalendar(start);
  if (!from) return null;
  const to = pacificCalendar(end);
  if (!to || to.isoDay <= from.isoDay) return `${from.month} ${from.day}`;

  if (to.year !== from.year) {
    return `${from.month} ${from.day}, ${from.year}–${to.month} ${to.day}, ${to.year}`;
  }
  if (to.month !== from.month) {
    return `${from.month} ${from.day}–${to.month} ${to.day}`;
  }
  return `${from.month} ${from.day}–${to.day}`;
}

/** One line of an event's schedule: the day ("Sat, Jan 9") and its time. */
export interface EventDateLine {
  day: string;
  time: string;
}

/**
 * The schedule split into display lines, in Pacific time. A same-day event is
 * one line with a time range ("9:00 AM–7:00 PM"); a multi-day event is two
 * lines, the start day with its start time and the end day with its end time.
 */
export function formatEventDateTimeLines(
  start: string | null | undefined,
  end?: string | null
): EventDateLine[] {
  const from = pacificCalendar(start);
  if (!from) return [];
  const startDay = `${from.weekday}, ${from.month} ${from.day}`;
  const to = pacificCalendar(end);

  if (!to || (to.isoDay === from.isoDay && to.time === from.time)) {
    return [{ day: startDay, time: from.time }];
  }
  if (to.isoDay <= from.isoDay) {
    return [{ day: startDay, time: `${from.time}–${to.time}` }];
  }
  return [
    { day: startDay, time: from.time },
    { day: `${to.weekday}, ${to.month} ${to.day}`, time: to.time },
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
