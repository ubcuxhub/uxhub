import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import type { EventRow } from "@/lib/supabase/models";
import type { Json } from "@/lib/supabase/database.types";
import { fetchEventHistoryInfo } from "@/lib/supabase-helpers/event-mutations";

function saveInput(e: EventRow, operation = randomUUID()) {
  return { p_event_id: e.id, p_draft_id: null!, p_draft_revision: 0,
    p_event: { name: e.name, short_description: "Overview", description: "Description", status: e.status, publish_at: e.publish_at,
      starts_at: e.starts_at, ends_at: e.ends_at, max_capacity: e.max_capacity, regular_price: e.regular_price, member_price: e.member_price,
      _operation_id: operation, _expected_revision: e.revision } as Json,
    p_slug: null!, p_expected_image_url: null!, p_expected_header_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] };
}

describe("safe event mutations", () => {
  it("returns the original committed result on replay and rejects a concurrent stale editor", () => withFixtures(async f => {
    const e = await f.createEvent({ starts_at: "2099-11-02T18:00:00Z", ends_at: "2099-11-02T19:00:00Z" });
    const args = saveInput(e); f.track("admin_event_mutations", (args.p_event as { _operation_id: string })._operation_id);
    const first = await f.supabase.rpc("save_admin_event_builder", args);
    expect(first.error).toBeNull();
    const again = await f.supabase.rpc("save_admin_event_builder", args);
    expect(again.error).toBeNull(); expect(again.data).toEqual(first.data);
    const stale = await f.supabase.rpc("save_admin_event_builder", saveInput(e));
    expect(stale.error?.hint).toBe("EVENT_REVISION_CONFLICT");
    const changedReplay = await f.supabase.rpc("save_admin_event_builder", { ...args, p_event: { ...(args.p_event as object), name: "Different request" } });
    expect(changedReplay.error?.hint).toBe("EVENT_REVISION_CONFLICT");
  }));

  it("allows only one writer for concurrent identical revisions", () => withFixtures(async f => {
    const e = await f.createEvent({ starts_at: "2099-11-02T18:00:00Z", ends_at: "2099-11-02T19:00:00Z" });
    const inputs = [saveInput(e),saveInput(e)];
    inputs.forEach(args => f.track("admin_event_mutations", (args.p_event as { _operation_id: string })._operation_id));
    const results = await Promise.all(inputs.map(args => f.supabase.rpc("save_admin_event_builder", args)));
    expect(results.filter(r => !r.error)).toHaveLength(1);
    expect(results.find(r => r.error)?.error?.hint).toBe("EVENT_REVISION_CONFLICT");
  }));

  it("locks historical event details, permits idempotent resources after deadlines, and retains people", () => withFixtures(async f => {
    const e = await f.createEvent({ status: "active", starts_at: "2020-11-02T18:00:00Z", ends_at: "2020-11-03T19:00:00Z" });
    const person = await f.supabase.from("mentors").insert({ full_name: "Historical person", owner_event_id: e.id }).select().single();
    expect(person.error).toBeNull();
    const full = await f.supabase.rpc("save_admin_event_builder", saveInput(e));
    expect(full.error?.hint).toBe("EVENT_HISTORY_LOCKED");
    const overview = await f.supabase.rpc("update_admin_event_schedule", { p_event_id: e.id, p_patch: { status: "draft" } });
    expect(overview.error?.hint).toBe("EVENT_HISTORY_LOCKED");
    const op = f.track("admin_event_mutations", randomUUID());
    const link = { id: randomUUID(), type: "event_recap", label: "Recap", url: "https://example.test/recap", visibility: "after_event" };
    const args = { p_event_id: e.id, p_revision: e.revision, p_links: [link], p_operation_id: op };
    const first = await f.supabase.rpc("save_past_event_resources", args);
    expect(first.error).toBeNull();
    expect((await f.supabase.rpc("save_past_event_resources", args)).data).toEqual(first.data);
    expect((await f.supabase.from("mentors").select("full_name").eq("id", person.data!.id).single()).data?.full_name).toBe("Historical person");
    expect((await f.supabase.from("events").select("status,ends_at").eq("id",e.id).single()).data?.status).toBe("active");
    expect((await clientAs(null).from("event_links").select("id").eq("id",link.id)).data).toHaveLength(1);
    const invalid = await f.supabase.rpc("save_past_event_resources", { ...args, p_operation_id: randomUUID(), p_revision: (first.data as { revision: number }).revision, p_links: [{ ...link, url: "javascript:alert(1)" }] });
    expect(invalid.error?.hint).toBe("EVENT_CONTENT_INVALID");
  }));

  it("denies direct historical writes and receipt access to browsers", () => withFixtures(async f => {
    const e = await f.createEvent({ status: "active", starts_at: "2020-11-02T18:00:00Z", ends_at: "2020-11-03T19:00:00Z" });
    const admin = await f.createUser({ role_access: "admin" });
    const browser = clientAs(admin);
    expect((await browser.from("events").update({ name: "Forged" }).eq("id",e.id)).error?.hint).toBe("EVENT_HISTORY_LOCKED");
    expect((await browser.from("check_in_sessions").insert({ event_id: e.id,name:"Forged",start_time:e.starts_at!,end_time:e.ends_at! })).error).not.toBeNull();
    for (const client of [browser, clientAs(null), clientAs(await f.createUser())]) {
      expect((await client.rpc("save_past_event_resources", { p_event_id:e.id,p_revision:0,p_links:[],p_operation_id:randomUUID() })).error?.code).toBe("42501");
      expect((await client.from("admin_event_mutations").select()).error?.code).toBe("42501");
    }
  }));

  it.each(["pending", "authorized", "completed", "canceled", "failed"] as const)("protects %s purchases and replays eligible deletion", status => withFixtures(async f => {
    const e = await f.createEvent(); const user = await f.createUser();
    const purchase = await f.supabase.from("purchases").insert({ event_id:e.id,user_id:user.id,kind:"event_ticket",status,amount_cents:1000,currency:"CAD",idempotency_key:randomUUID() }).select().single();
    expect(purchase.error).toBeNull(); f.track("purchases",purchase.data!.id);
    const op = f.track("admin_event_mutations",randomUUID());
    const args = { p_event_id:e.id,p_operation_id:op };
    const first = await f.supabase.rpc("delete_admin_event_safely",args);
    if (status === "failed") {
      expect(first.error).toBeNull();
      expect((await f.supabase.rpc("delete_admin_event_safely",args)).data).toEqual(first.data);
      expect((await f.supabase.from("events").select("id").eq("id",e.id)).data).toHaveLength(0);
    } else {
      expect(first.error).not.toBeNull();
      expect((await f.supabase.from("purchases").select("id").eq("id",purchase.data!.id)).data).toHaveLength(1);
      expect((await fetchEventHistoryInfo(f.supabase,e.id)).protectedPurchases).toBe(1);
    }
  }));
});

it("counts distinct attendees across sessions, retains history on resource saves, and cascades eligible deletion", () => withFixtures(async f => {
  const e = await f.createEvent({ status: "active", starts_at: "2020-11-02T18:00:00Z", ends_at: "2020-11-03T19:00:00Z" });
  const users = [await f.createUser(), await f.createUser()];
  const tickets = await f.supabase.from("event_tickets").insert(users.map(user => ({ event_id: e.id, user_id: user.id }))).select();
  expect(tickets.error).toBeNull();
  const sessions = await f.supabase.from("check_in_sessions").insert(["One", "Two"].map(name => ({ event_id:e.id, name, start_time:e.starts_at, end_time:e.ends_at }))).select();
  expect(sessions.error).toBeNull();
  const checkIns = await f.supabase.from("check_ins").insert(sessions.data!.map(session => ({ check_in_session_id:session.id,ticket_id:tickets.data![0].id })));
  expect(checkIns.error).toBeNull();
  expect(await fetchEventHistoryInfo(f.supabase,e.id)).toEqual({ registered:2, checkedIn:1, teams:0, protectedPurchases:0 });
  const resourceOp = f.track("admin_event_mutations",randomUUID());
  expect((await f.supabase.rpc("save_past_event_resources",{ p_event_id:e.id,p_revision:e.revision,p_operation_id:resourceOp,p_links:[] })).error).toBeNull();
  expect((await f.supabase.from("event_tickets").select("id").eq("event_id",e.id)).data?.map(row => row.id).sort()).toEqual(tickets.data!.map(row => row.id).sort());
  expect((await fetchEventHistoryInfo(f.supabase,e.id)).checkedIn).toBe(1);
  const deletion = await f.supabase.rpc("delete_admin_event_safely",{ p_event_id:e.id,p_operation_id:f.track("admin_event_mutations",randomUUID()) });
  expect(deletion.error).toBeNull();
  expect((await f.supabase.from("check_ins").select("id").in("ticket_id",tickets.data!.map(row => row.id))).data).toHaveLength(0);
  expect((await f.supabase.from("user_info").select("id").in("id",users.map(user => user.id))).data).toHaveLength(2);
}));
