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

export function eventYear(value: Date): number {
  return value.getUTCFullYear();
}
