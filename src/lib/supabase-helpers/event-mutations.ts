import type { SaveAdminEventResult, SavedEventPublication } from "@/features/admin/actions";
import type { EventContent } from "@/features/admin/lib/event-content";
import type { DbClient } from "./types";
import { TABLES } from "./tables";

export function eventMutationResult(value: unknown): SaveAdminEventResult {
  const saved = value as { id?: string; revision?: number; page_slug?: string; content?: EventContent; publication?: SavedEventPublication; check_in_session_ids?: string[]; question_ids?: string[]; date_location_revision?: number } | null;
  if (!saved?.id) throw new Error("The save returned no event identity.");
  return { id: saved.id, revision: saved.revision, ...(saved.page_slug ? { pageSlug: saved.page_slug } : {}), content: saved.content ?? undefined, publication: saved.publication, checkInSessionIds: saved.check_in_session_ids ?? [], questionIds: saved.question_ids ?? [], dateLocationRevision: saved.date_location_revision };
}

export async function fetchEventMutationResult(client: DbClient, id: string) {
  const { data, error } = await client.from(TABLES.adminEventMutations).select("result").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? eventMutationResult(data.result) : null;
}

/** Authenticate a drawer retry against either its quick-edit or full-publication
 * receipt before returning the current row (the scheduler may have advanced it).
 */
export async function hasEventScheduleReceipt(client: DbClient, id: string, eventId: string, input: import("@/features/admin/lib/event-publication").EventScheduleInput) {
  const { data, error } = await client.from(TABLES.adminEventMutations).select("request").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const request = data.request as { event_id?: string; patch?: Record<string, unknown>; event?: Record<string, unknown> };
  const saved = request.patch ?? request.event;
  const fields = ["status", "publish_at", "starts_at", "ends_at", "registration_opens_at", "registration_closes_at"] as const;
  if (request.event_id !== eventId || !saved || fields.some(key => {
    const expected = input[key]; const value = saved[key];
    return key === "status" ? expected !== value : expected == null ? value != null : typeof value !== "string" || Date.parse(expected) !== Date.parse(value);
  }) || (input.expectedRevision !== undefined && saved._expected_revision !== input.expectedRevision)) throw Object.assign(new Error("This retry differs from the original request."), { hint: "EVENT_REVISION_CONFLICT" });
  return true;
}

export interface EventHistoryInfo { registered: number; checkedIn: number; teams: number; protectedPurchases: number }
export async function fetchEventHistoryInfo(client: DbClient, eventId: string): Promise<EventHistoryInfo> {
  const [tickets, teams, purchases] = await Promise.all([
    client.from(TABLES.eventTickets).select("id,check_ins(id)").eq("event_id", eventId),
    client.from(TABLES.teams).select("id", { count: "exact", head: true }).eq("event_id", eventId),
    client.from(TABLES.purchases).select("id", { count: "exact", head: true }).eq("event_id", eventId).neq("status", "failed"),
  ]);
  for (const result of [tickets,teams,purchases]) if (result.error) throw result.error;
  return { registered: tickets.data?.length ?? 0, checkedIn: tickets.data?.filter(row => row.check_ins.length > 0).length ?? 0, teams: teams.count ?? 0, protectedPurchases: purchases.count ?? 0 };
}

/**
 * What stops an event from being deleted, by the database's own rule
 * (`delete_event_before_safe_mutations`): members (not staff, not deleted)
 * with a ticket, a held offer or a payment in flight, and any live purchase
 * (docs/event-states.md, "Live purchases"). Staff test registrations on a
 * draft block nothing. Service role only.
 */
export interface EventDeletionBlockers { memberTickets: number; memberOffers: number; memberPendingPurchases: number; livePurchases: boolean }
export async function fetchEventDeletionBlockers(serviceClient: DbClient, eventId: string): Promise<EventDeletionBlockers> {
  const [commitments, live] = await Promise.all([
    serviceClient.rpc("event_member_commitments", { p_event_id: eventId }),
    serviceClient.rpc("event_has_live_purchases", { p_event_id: eventId }),
  ]);
  if (commitments.error) throw commitments.error;
  if (live.error) throw live.error;
  const row = commitments.data?.[0];
  return { memberTickets: row?.tickets ?? 0, memberOffers: row?.offers ?? 0, memberPendingPurchases: row?.pending_purchases ?? 0, livePurchases: Boolean(live.data) };
}

export function eventDeletionBlocked(blockers: EventDeletionBlockers) {
  return blockers.livePurchases || blockers.memberTickets > 0 || blockers.memberOffers > 0 || blockers.memberPendingPurchases > 0;
}
