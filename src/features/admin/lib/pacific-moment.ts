import { strictPacificTimestamp } from "@/lib/date";

/**
 * Rules for a Pacific `YYYY-MM-DDTHH:mm` wall time that the builder and the
 * overview's quick edit share, so a value one of them saves the other accepts.
 */

export const PACIFIC_MOMENT_ERROR = "Use an unambiguous, valid Pacific date and time.";

/**
 * Why a moment can't be saved, or null when it is empty or valid. A half
 * filled one (`2026-11-19T`) gets `incomplete`; one that doesn't exist or
 * happens twice at a daylight-saving change gets `PACIFIC_MOMENT_ERROR`.
 */
export function pacificMomentProblem(value: string, incomplete = PACIFIC_MOMENT_ERROR): string | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date || !time) return incomplete;
  return strictPacificTimestamp(value) ? null : PACIFIC_MOMENT_ERROR;
}

/** Whether both moments are valid and `end` falls at or before `start`, as instants. */
export function momentEndsTooEarly(start: string, end: string): boolean {
  const from = strictPacificTimestamp(start);
  const to = strictPacificTimestamp(end);
  return Boolean(from && to && Date.parse(from) >= Date.parse(to));
}
