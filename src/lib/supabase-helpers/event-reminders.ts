import type { ParticipantLocation } from "@/lib/location";

import type { DbClient } from "./types";

/**
 * Event reminder emails (supabase/README.md, "Event reminder emails"): the
 * service-role functions behind `/api/internal/event-reminders`. The send
 * table lives in the private `event_reminders` schema, so these RPCs are the
 * only way in, and only for the service role.
 */

/** An event's `reminder_schedule`: which reminders its ticket holders get. */
export type ReminderSchedule = "off" | "1d" | "2h" | "both";

export const REMINDER_SCHEDULES: readonly ReminderSchedule[] = ["off", "1d", "2h", "both"];

export function isReminderSchedule(value: unknown): value is ReminderSchedule {
  return typeof value === "string" && (REMINDER_SCHEDULES as readonly string[]).includes(value);
}

/** One reminder: a day before the event starts, or two hours before. */
export type EventReminderKind = "1d" | "2h";

const KINDS: readonly string[] = ["1d", "2h"] satisfies EventReminderKind[];

export interface ClaimedEventReminder {
  sendId: string;
  kind: EventReminderKind;
  /** Including this one; the fifth failure is the last. */
  attempts: number;
  ticketId: string;
  eventId: string;
  email: string;
  firstName: string;
  eventName: string;
  eventSlug: string;
  startsAt: string;
  endsAt: string | null;
  /** The holder's view of the first day's location, unrestricted. */
  location: ParticipantLocation | null;
}

/** The most attempts a reminder gets before it is left unsent. */
export const MAX_EVENT_REMINDER_ATTEMPTS = 5;

function parseLocation(value: unknown): ParticipantLocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const location = value as Record<string, unknown>;
  if (!["in_person", "online", "hybrid"].includes(location.type as string)) return null;
  const text = (key: string) => (typeof location[key] === "string" && location[key] ? (location[key] as string) : undefined);
  return {
    type: location.type as ParticipantLocation["type"],
    restricted: false,
    building: text("building"),
    room: text("room"),
    address: text("address"),
    map_url: text("map_url"),
  };
}

/**
 * Claims up to `limit` due reminders. `eventIds` narrows the claim to those
 * events (tests use it so a seeded database's own due reminders stay put).
 */
export async function claimEventReminders(
  serviceClient: DbClient,
  limit: number,
  eventIds?: string[]
): Promise<ClaimedEventReminder[]> {
  const { data, error } = await serviceClient.rpc("claim_event_reminders", {
    p_limit: limit,
    ...(eventIds ? { p_event_ids: eventIds } : {}),
  });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (!KINDS.includes(row.kind) || !row.starts_at) return [];
    return [
      {
        sendId: row.send_id,
        kind: row.kind as EventReminderKind,
        attempts: row.attempts,
        ticketId: row.ticket_id,
        eventId: row.event_id,
        email: row.email,
        firstName: row.first_name,
        eventName: row.event_name,
        eventSlug: row.event_slug,
        startsAt: row.starts_at,
        endsAt: row.ends_at ?? null,
        location: parseLocation(row.location),
      },
    ];
  });
}

/**
 * Records a claimed reminder as sent, or as failed with a short code (never a
 * message), which hands it back for the next run until its fifth attempt.
 * Returns the attempts so far, or null when it was no longer claimed.
 */
export async function completeEventReminder(
  serviceClient: DbClient,
  sendId: string,
  outcome: { sent: true } | { sent: false; errorCode: string }
): Promise<number | null> {
  const { data, error } = await serviceClient.rpc("complete_event_reminder", {
    p_send_id: sendId,
    p_sent: outcome.sent,
    ...(outcome.sent ? {} : { p_error_code: outcome.errorCode }),
  });
  if (error) throw error;
  return data ?? null;
}

/**
 * Hands back claims the route never tried, without counting an attempt.
 * Returns how many it released.
 */
export async function releaseEventReminders(
  serviceClient: DbClient,
  sendIds: string[],
  reason: string
): Promise<number> {
  if (sendIds.length === 0) return 0;
  const { data, error } = await serviceClient.rpc("release_event_reminders", {
    p_send_ids: sendIds,
    p_reason: reason,
  });
  if (error) throw error;
  return data ?? 0;
}
