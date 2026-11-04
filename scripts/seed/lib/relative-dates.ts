const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(value: Date): Date {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid seed reference date");
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

export function addMonths(value: Date, months: number): Date {
  const result = new Date(value);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function timestamp(
  value: Date,
  hour = 0,
  minute = 0
): string {
  const result = new Date(value);
  result.setUTCHours(hour, minute, 0, 0);
  return result.toISOString();
}

const vancouverClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Vancouver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The Vancouver wall clock at `instant`, read back as if it were UTC. */
function vancouverWallClockMs(instant: number): number {
  const part = (type: Intl.DateTimeFormatPartTypes, parts: Intl.DateTimeFormatPart[]) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const parts = vancouverClock.formatToParts(new Date(instant));
  return Date.UTC(
    part("year", parts),
    part("month", parts) - 1,
    part("day", parts),
    part("hour", parts),
    part("minute", parts)
  );
}

/**
 * The instant a Vancouver wall-clock `HH:mm` falls on, on `value`'s UTC
 * calendar day. Event start and end times are local, unlike `timestamp`.
 * Mirrors `datetimeLocalToTimestamptz` in src/lib/date.ts, which the seed
 * can't import without Node warning about its module type.
 */
export function pacificTimestamp(value: Date, time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid seed time ${time}`);
  const desired = Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    Number(match[1]),
    Number(match[2])
  );
  let instant = desired;
  for (let pass = 0; pass < 2; pass += 1) {
    instant += desired - vancouverWallClockMs(instant);
  }
  return new Date(instant).toISOString();
}

export function eventYear(value: Date): number {
  return value.getUTCFullYear();
}
