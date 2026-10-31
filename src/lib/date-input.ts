/**
 * Parsing and formatting for the date and time fields (§3.11). Everything is
 * Pacific wall-clock: a date is "2026-11-14" and a time is "21:00", never a
 * `Date`, so the viewer's timezone can't shift a value. `today` is passed in by
 * the caller (see `usePacificNow`) so these stay pure and testable.
 */

export type IsoDate = `${number}-${number}-${number}`;
export type WallTime = `${number}:${number}`;

export const DATE_INPUT_ERROR = "Use a real date, like Nov 14.";
export const END_TIME_ERROR = "End time is before the start time.";

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const WEEKDAY_NAMES = new Set([
  "sun",
  "mon",
  "tue",
  "tues",
  "wed",
  "thu",
  "thur",
  "thurs",
  "fri",
  "sat",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isRealDate(year: number, month: number, day: number) {
  return (
    year >= 1000 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}` as IsoDate;
}

function splitIso(date: IsoDate) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function monthFromWord(word: string): number | null {
  if (word === "sept") return 9;
  const index = MONTHS.findIndex(
    (abbr, i) => word === abbr || word === MONTH_NAMES[i],
  );
  return index === -1 ? null : index + 1;
}

/** The next occurrence of month/day on or after `today`; a Feb 29 may skip years. */
function nextOccurrence(month: number, day: number, today: IsoDate) {
  const { year: startYear } = splitIso(today);
  for (let year = startYear; year <= startYear + 8; year += 1) {
    if (!isRealDate(year, month, day)) continue;
    const iso = toIso(year, month, day);
    if (iso >= today) return iso;
  }
  return null;
}

function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = splitIso(date);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return toIso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function withinRange(date: IsoDate, min?: IsoDate, max?: IsoDate) {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
}

function resolveParts(
  month: number,
  day: number,
  year: number | null,
  today: IsoDate,
): IsoDate | null {
  if (year === null) return nextOccurrence(month, day, today);
  return isRealDate(year, month, day) ? toIso(year, month, day) : null;
}

function expandYear(text: string): number {
  const year = Number(text);
  return text.length === 2 ? 2000 + year : year;
}

function parseDateParts(
  raw: string,
  today: IsoDate,
): IsoDate | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  if (text === "today") return today;
  if (text === "tomorrow") return addDays(today, 1);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return resolveParts(Number(iso[2]), Number(iso[3]), Number(iso[1]), today);

  const numeric = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(text);
  if (numeric) {
    return resolveParts(
      Number(numeric[1]),
      Number(numeric[2]),
      numeric[3] ? expandYear(numeric[3]) : null,
      today,
    );
  }

  const tokens = text
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length && WEEKDAY_NAMES.has(tokens[0])) tokens.shift();
  if (tokens.length < 2 || tokens.length > 3) return null;

  const [first, second, third] = tokens;
  const year = third === undefined ? null : /^\d{4}$/.test(third) ? Number(third) : NaN;
  if (Number.isNaN(year)) return null;

  const monthFirst = monthFromWord(first);
  if (monthFirst && /^\d{1,2}$/.test(second)) {
    return resolveParts(monthFirst, Number(second), year, today);
  }
  const monthSecond = monthFromWord(second);
  if (monthSecond && /^\d{1,2}$/.test(first)) {
    return resolveParts(monthSecond, Number(first), year, today);
  }
  return null;
}

/**
 * "Nov 14", "november 14 2026", "14 Nov", "11/14", "11/14/2026", "2026-11-14",
 * "Sat, Nov 14, 2026", "today", "tomorrow". With no year, the next occurrence
 * on or after `today`. A date outside `min`/`max`, or one that doesn't exist
 * ("Feb 30"), is `null`.
 */
export function parseDateInput(
  text: string,
  opts: { today: IsoDate; min?: IsoDate; max?: IsoDate },
): IsoDate | null {
  const date = parseDateParts(text, opts.today);
  return date && withinRange(date, opts.min, opts.max) ? date : null;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Sat, Nov 14, 2026". The year is always shown. */
export function formatDateInput(date: IsoDate): string {
  const { year, month, day } = splitIso(date);
  const parts = dateFormatter.formatToParts(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")}`;
}

export const minutesOf = (time: WallTime) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const timeOf = (minutes: number): WallTime =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` as WallTime;

/**
 * "9", "9pm", "9:30 a", "21:00", "0930", "noon", "midnight".
 *
 * Without AM/PM a time reads as PM, unless the hour is 13–23 or zero-padded
 * ("09:00", "0930"), which read as 24-hour. With `after`, an ambiguous hour
 * takes the first match after it: after 9:00 AM, "11" is 11:00 AM. An end time
 * with no match after the start falls back to the PM reading, so the caller's
 * check can say it is before the start.
 */
export function parseTimeInput(
  text: string,
  opts: { after?: WallTime } = {},
): WallTime | null {
  const input = text.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  if (!input) return null;
  if (input === "noon") return "12:00";
  if (input === "midnight") return "00:00";

  const match =
    /^(\d{1,2}):(\d{2})(a|p|am|pm)?$/.exec(input) ??
    /^(\d{1,2})(\d{2})(a|p|am|pm)?$/.exec(input) ??
    /^(\d{1,2})()(a|p|am|pm)?$/.exec(input);
  if (!match) return null;

  const hourText = match[1];
  const hour = Number(hourText);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.[0];
  if (minute > 59 || hour > 23) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    return timeOf(((hour % 12) + (meridiem === "p" ? 12 : 0)) * 60 + minute);
  }

  const is24Hour = hour === 0 || hour >= 13 || (hourText.length === 2 && hourText[0] === "0");
  if (is24Hour) return timeOf(hour * 60 + minute);

  const am = (hour % 12) * 60 + minute;
  const pm = am + 12 * 60;
  if (opts.after) {
    const start = minutesOf(opts.after);
    if (am > start) return timeOf(am);
  }
  return timeOf(pm);
}

/** "9:00 AM". Built by hand: `Intl` puts a narrow no-break space before AM/PM. */
export function formatTimeInput(time: WallTime): string {
  const total = minutesOf(time);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${hour % 12 || 12}:${pad(minute)} ${hour >= 12 ? "PM" : "AM"}`;
}

/** "2 hr 15 min", "45 min", "3 hr". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/**
 * The list under a TimePicker: every `stepMinutes` of the day. With `after`
 * (end-time mode) it starts at the first step past it and each option carries
 * how long the event would run.
 */
export function timeOptions(
  opts: { after?: WallTime; stepMinutes?: number } = {},
): { value: WallTime; label: string; duration?: string }[] {
  const step = opts.stepMinutes ?? 15;
  const start = opts.after ? minutesOf(opts.after) : null;
  const options: { value: WallTime; label: string; duration?: string }[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    if (start !== null && minutes <= start) continue;
    const value = timeOf(minutes);
    options.push({
      value,
      label: formatTimeInput(value),
      ...(start === null ? {} : { duration: formatDuration(minutes - start) }),
    });
  }
  return options;
}

/** Whether an end time falls before its start; equal times are allowed. */
export function isEndBeforeStart(end: WallTime, start: WallTime): boolean {
  return minutesOf(end) < minutesOf(start);
}
