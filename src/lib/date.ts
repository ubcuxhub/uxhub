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

export function getPacificStartDefaults(date = new Date()) {
  const parts = pacificParts(date);
  return {
    start_date: `${parts.year}-${parts.month}-${parts.day}`,
    start_time: `${parts.hour}:${parts.minute}`,
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
