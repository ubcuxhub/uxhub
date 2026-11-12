import type { CheckInSession } from "@/features/admin/types";

type SessionTimes = Pick<CheckInSession, "id" | "start_time" | "end_time">;

const time = (value: string | null) =>
  value === null ? null : new Date(value).getTime();

/**
 * The session the scanner starts on: the one running at `now`, else the next
 * to start (doors often open early), else the last one, so late arrivals
 * still land somewhere sensible. `sessions` are in start order.
 */
export function defaultCheckInSessionId(
  sessions: SessionTimes[],
  now: Date
): string | null {
  const at = now.getTime();

  const running = sessions.find((session) => {
    const start = time(session.start_time);
    const end = time(session.end_time);
    return start !== null && end !== null && start <= at && at <= end;
  });
  if (running) return running.id;

  const next = sessions.find((session) => {
    const start = time(session.start_time);
    return start !== null && start > at;
  });
  if (next) return next.id;

  return sessions.at(-1)?.id ?? null;
}
