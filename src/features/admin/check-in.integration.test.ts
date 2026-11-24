import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";
import { mutateItemCheckIn, fetchItemCheckInSnapshot } from "@/lib/supabase-helpers/item-check-in";
vi.mock("server-only", () => ({}));
const context = vi.hoisted(() => ({ requireAdmin: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: context.requireAdmin, requireManager: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: context.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { regenerateTicketQrAction, voidTicketAction } from "@/features/admin/actions";

async function setup(f: Fixtures, times = { start: "2026-01-01T18:00:00Z", end: "2026-01-01T19:00:00Z" }) {
  const db = f.supabase;

  const event = await f.createEvent({ agenda_enabled: false });
  const admin = await f.createUser({ role_access: "admin" });

  const manager = await f.createUser({ role_access: "manager" });

  const user = await f.createUser({ first_name: "Ada", last_name: "Lovelace" });
  const day = await db.from("event_agenda_days").insert({ event_id: event.id, date: times.start.slice(0, 10), title: "Day" }).select().single();

  if (day.error)
    throw day.error;
  const item = await db.from("event_agenda_items").insert({ event_agenda_day_id: day.data.id, title: "Doors", start_time: "10:00", end_time: "11:00", starts_at: times.start, ends_at: times.end, check_in: true }).select().single();

  if (item.error)
    throw item.error;
  const session = await db.from("check_in_sessions").insert({ event_id: event.id, agenda_item_id: item.data.id, name: "Doors", start_time: times.start, end_time: times.end }).select().single();

  if (session.error)
    throw session.error;
  const ticket = await db.from("event_tickets").insert({ event_id: event.id, user_id: user.id }).select().single();

  if (ticket.error)
    throw ticket.error;
  return { db, event, admin, manager, user, item: item.data, session: session.data, ticket: ticket.data, input: { eventId: event.id, itemId: item.data.id, ticketId: ticket.data.id } };
}

describe("atomic item check-in", () => {
  it.each([{ start: "2020-11-01T07:00:00Z", end: "2020-11-01T11:00:00Z" }, { start: "2035-11-01T07:00:00Z", end: "2035-11-01T11:00:00Z" }])("has no past/future time or hidden-schedule gate", times => withFixtures(async f => {
    const x = await setup(f, times);

    const client = clientAs(x.admin);
    const result = await mutateItemCheckIn(client, x.input);

    expect(result.status).toBe("checked_in");
    const snap = await fetchItemCheckInSnapshot(client, x.event.id, x.item.id);

    expect(snap.attendance).toHaveLength(1);

    expect(snap.attendance[0]).toMatchObject({ method: "manual", operator: "Integration Test" });
    expect((await mutateItemCheckIn(client, { ...x.input, undoVersion: snap.attendance[0].attendanceVersion })).status).toBe("undone");
  }));
  it("serializes mixed concurrent scans/manual calls, preserving one time/operator/method and activity", () => withFixtures(async f => {
    const x = await setup(f);

    const admin = clientAs(x.admin), manager = clientAs(x.manager);
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => mutateItemCheckIn(i % 2 ? admin : manager, i % 2 ? x.input : { eventId: x.event.id, itemId: x.item.id, code: x.ticket.qr_token })));
    expect(results.filter(r => r.status === "checked_in")).toHaveLength(1);

    expect(results.filter(r => r.status === "already_checked_in")).toHaveLength(5);
    const versions = results.map(r => "attendanceVersion" in r ? r.attendanceVersion : null);

    expect(new Set(versions).size).toBe(1);
    const activity = await x.db.from("check_in_activity").select().eq("item_id", x.item.id);

    expect(activity.data).toHaveLength(1);

    expect([x.admin.id, x.manager.id]).toContain(activity.data![0].operator_id);
    expect((await x.db.from("check_ins").select().eq("ticket_id", x.ticket.id)).data).toHaveLength(1);
  }));
  it("binds undo to the displayed version, preserving a later rescan and its activity", () => withFixtures(async f => {
    const x = await setup(f);

    const client = clientAs(x.admin);
    const first = await mutateItemCheckIn(client, x.input);

    if (!("attendanceVersion" in first))
      throw new Error("Missing attendance");
    await mutateItemCheckIn(client, { ...x.input, undoVersion: first.attendanceVersion });
    const second = await mutateItemCheckIn(client, x.input);

    expect(second.status).toBe("checked_in");
    expect((await mutateItemCheckIn(client, { ...x.input, undoVersion: first.attendanceVersion })).status).toBe("stale_undo");
    expect((await fetchItemCheckInSnapshot(client, x.event.id, x.item.id)).attendance[0].attendanceVersion).not.toBe(first.attendanceVersion);
    const activity = await x.db.from("check_in_activity").select().eq("item_id", x.item.id);

    expect(activity.data).toHaveLength(2);

    expect(activity.data!.filter(a => a.undone_at)).toHaveLength(1);
  }));
  it("rejects foreign tickets/items, disabled targets and unknown codes without writes", () => withFixtures(async f => {
    const x = await setup(f);

    const other = await f.createEvent({ slug: `other-${f.tag}` });

    const client = clientAs(x.admin);
    const foreign = await x.db.from("event_tickets").insert({ event_id: other.id, user_id: x.user.id }).select().single();

    if (foreign.error)
      throw foreign.error;
    expect((await mutateItemCheckIn(client, { ...x.input, ticketId: foreign.data.id })).status).toBe("rejected");
    expect((await mutateItemCheckIn(client, { eventId: x.event.id, itemId: x.item.id, code: "x" })).status).toBe("rejected");
    await expect(mutateItemCheckIn(client, { ...x.input, eventId: other.id })).rejects.toBeTruthy();
    await expect(mutateItemCheckIn(client, { ...x.input, itemId: randomUUID() })).rejects.toBeTruthy();
    await x.db.from("event_agenda_items").update({ check_in: false }).eq("id", x.item.id).throwOnError();
    await expect(mutateItemCheckIn(client, x.input)).rejects.toBeTruthy();
    expect((await x.db.from("check_in_activity").select().eq("event_id", x.event.id)).data).toEqual([]);
    expect((await x.db.from("check_ins").insert({ ticket_id: foreign.data.id, check_in_session_id: x.session.id })).error).toBeTruthy();
  }));
  it("protects attribution/attendance from direct requests and staff data from attendees/anonymous users", () => withFixtures(async f => {
    const x = await setup(f);

    const staff = clientAs(x.admin), student = clientAs(x.user), anon = clientAs(null);
    await mutateItemCheckIn(staff, x.input);
    for (const client of [student, anon]) {
      await expect(mutateItemCheckIn(client, x.input)).rejects.toBeTruthy();
      const read = await client.from("check_in_activity").select().eq("event_id", x.event.id);

      expect(read.data ?? []).toHaveLength(0);
    }
    expect((await staff.from("check_ins").insert({ ticket_id: x.ticket.id, check_in_session_id: x.session.id })).error).toBeTruthy();
    expect((await staff.from("check_in_activity").update({ operator_id: x.user.id }).eq("item_id", x.item.id)).error).toBeTruthy();
    const spoof = await staff.rpc("mutate_item_check_in", { p_event_id: x.event.id, p_item_id: x.item.id, p_ticket_id: x.ticket.id, p_operator_id: x.user.id } as never);

    expect(spoof.error).toBeTruthy();
  }));
  it("scopes attendance per item and retains unknown provenance for old rows", () => withFixtures(async f => {
    const x = await setup(f);

    const client = clientAs(x.admin);
    await x.db.from("check_ins").insert({ ticket_id: x.ticket.id, check_in_session_id: x.session.id, checked_in_at: "2020-01-01T00:00:00Z" }).throwOnError();
    const snap = await fetchItemCheckInSnapshot(client, x.event.id, x.item.id);

    expect(snap.attendance[0]).toMatchObject({ operator: null, method: null, checkedInAt: "2020-01-01T00:00:00+00:00" });
    const unknown = await fetchItemCheckInSnapshot(client, x.event.id, randomUUID());

    expect(unknown.attendance).toEqual([]);
  }));
});

it("keeps two items independent and serializes undo against a simultaneous scan", () => withFixtures(async f => {
  const x = await setup(f);

  const client = clientAs(x.admin);
  const second = await x.db.from("event_agenda_items").insert({ event_agenda_day_id: x.item.event_agenda_day_id, title: "Closing", start_time: "17:00", end_time: "18:00", starts_at: "2026-01-01T01:00:00Z", ends_at: "2026-01-01T02:00:00Z", check_in: true }).select().single();

  if (second.error)
    throw second.error;
  await x.db.from("check_in_sessions").insert({ event_id: x.event.id, agenda_item_id: second.data.id, name: "Closing" }).throwOnError();
  await mutateItemCheckIn(client, x.input);
  expect((await fetchItemCheckInSnapshot(client, x.event.id, second.data.id)).attendance).toEqual([]);
  await mutateItemCheckIn(client, { ...x.input, itemId: second.data.id });
  const original = (await fetchItemCheckInSnapshot(client, x.event.id, x.item.id)).attendance[0];
  await Promise.all([mutateItemCheckIn(client, { ...x.input, undoVersion: original.attendanceVersion }), mutateItemCheckIn(client, x.input)]);
  const remaining = await fetchItemCheckInSnapshot(client, x.event.id, x.item.id);
  if (remaining.attendance.length)
    expect(remaining.attendance[0].attendanceVersion).not.toBe(original.attendanceVersion);
  expect((await fetchItemCheckInSnapshot(client, x.event.id, second.data.id)).attendance).toHaveLength(1);
}));

// Exercise the incoming ticket controls against item-bound sessions.
const db = createIntegrationClient();
async function ticketHolder(fixtures: Fixtures) {
  const x = await setup(fixtures);
  context.requireAdmin.mockResolvedValue(x.admin);
  context.createClient.mockResolvedValue(clientAs(x.admin));
  const scan = (code: string) => mutateItemCheckIn(clientAs(x.admin), { eventId: x.event.id, itemId: x.item.id, code });
  return { scan, ticketId: x.ticket.id, qrToken: x.ticket.qr_token };
}
async function checkInRows(ticketId: string) {
  const { data, error } = await db.from("check_ins").select("checked_in_at").eq("ticket_id", ticketId);
  if (error) throw error;
  return data;
}

describe("admin ticket actions", () => {
  async function ticketExists(ticketId: string) {
    const { data, error } = await db.from("event_tickets").select("id").eq("id", ticketId);
    if (error) throw error;
    return data.length === 1;
  }

  /** Attaches a purchase to the holder's ticket, as checkout would. */
  async function attachPurchase(
    fixtures: Fixtures,
    ticketId: string,
    purchase: { amount_cents: number; status?: "completed" | "authorized"; refunded_cents?: number }
  ) {
    const { data: ticket, error: ticketError } = await db
      .from("event_tickets")
      .select("event_id, user_id")
      .eq("id", ticketId)
      .single();
    if (ticketError) throw ticketError;
    const { data, error } = await db
      .from("purchases")
      .insert({
        event_id: ticket.event_id,
        user_id: ticket.user_id,
        kind: "event_ticket",
        status: purchase.status ?? "completed",
        amount_cents: purchase.amount_cents,
        refunded_cents: purchase.refunded_cents ?? 0,
        currency: "CAD",
        idempotency_key: `${fixtures.tag}-${ticketId}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    const linked = await db.from("event_tickets").update({ purchase_id: data.id }).eq("id", ticketId);
    if (linked.error) throw linked.error;
    return data.id;
  }

  it("regenerates a QR code so the old one, screenshots included, stops scanning", () =>
    withFixtures(async (fixtures) => {
      const { scan, ticketId, qrToken } = await ticketHolder(fixtures);

      expect(await regenerateTicketQrAction(ticketId)).toEqual({ ok: true });

      const { data } = await db.from("event_tickets").select("qr_token").eq("id", ticketId).single();
      expect(data!.qr_token).toMatch(/^[0-9a-f]{32}$/);
      expect(data!.qr_token).not.toBe(qrToken);
      expect(await scan(qrToken)).toEqual({
        status: "rejected",
        reason: "not_found",
      });
      expect(await scan(data!.qr_token)).toMatchObject({
        status: "checked_in",
        name: "Ada Lovelace",
      });
      expect(await regenerateTicketQrAction("00000000-0000-4000-8000-000000000000")).toMatchObject({ ok: false });
    }));

  it("voids a free ticket and cancels its $0 registration", () =>
    withFixtures(async (fixtures) => {
      const { scan, ticketId, qrToken } = await ticketHolder(fixtures);
      const purchaseId = await attachPurchase(fixtures, ticketId, { amount_cents: 0 });

      expect(await voidTicketAction(ticketId)).toEqual({ ok: true });

      expect(await ticketExists(ticketId)).toBe(false);
      expect(await scan(qrToken)).toMatchObject({ status: "rejected" });
      const { data } = await db.from("purchases").select("status").eq("id", purchaseId).single();
      expect(data).toEqual({ status: "canceled" });
    }));

  it("refuses to void a checked-in ticket", () =>
    withFixtures(async (fixtures) => {
      const { scan, ticketId, qrToken } = await ticketHolder(fixtures);
      await scan(qrToken);

      expect(await voidTicketAction(ticketId)).toEqual({
        ok: false,
        error: expect.stringMatching(/checked in/),
      });
      expect(await ticketExists(ticketId)).toBe(true);
      expect(await checkInRows(ticketId)).toHaveLength(1);
    }));

  it("refuses to void a paid ticket until it is refunded in full", () =>
    withFixtures(async (fixtures) => {
      const { ticketId } = await ticketHolder(fixtures);
      const purchaseId = await attachPurchase(fixtures, ticketId, { amount_cents: 1500 });

      expect(await voidTicketAction(ticketId)).toEqual({
        ok: false,
        error: expect.stringMatching(/Refund it in Square/),
      });

      // Partially refunded: the club still holds money for this ticket.
      await db.from("purchases").update({ refunded_cents: 500 }).eq("id", purchaseId);
      expect(await voidTicketAction(ticketId)).toMatchObject({ ok: false });
      expect(await ticketExists(ticketId)).toBe(true);

      // Fully refunded (as a refund after check-in leaves it, once the
      // check-in is undone): nothing is held, so the ticket can go.
      await db.from("purchases").update({ refunded_cents: 1500 }).eq("id", purchaseId);
      expect(await voidTicketAction(ticketId)).toEqual({ ok: true });
      expect(await ticketExists(ticketId)).toBe(false);
      const { data } = await db.from("purchases").select("status, refunded_cents").eq("id", purchaseId).single();
      expect(data).toEqual({ status: "completed", refunded_cents: 1500 });
    }));

  it("refuses to void a ticket whose payment is still authorized", () =>
    withFixtures(async (fixtures) => {
      const { ticketId } = await ticketHolder(fixtures);
      await attachPurchase(fixtures, ticketId, { amount_cents: 1500, status: "authorized" });

      expect(await voidTicketAction(ticketId)).toMatchObject({ ok: false });
      expect(await ticketExists(ticketId)).toBe(true);
    }));
});
