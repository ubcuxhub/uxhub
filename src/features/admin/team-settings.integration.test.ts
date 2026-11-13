import type { Json } from "@/lib/supabase/database.types";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures, type Fixtures } from "@/test/integration";
import { createTeam, fetchEventTeamSettingsInfo, fetchUserTeam, joinTeam } from "@/lib/supabase-helpers/teams";
import { defaultFormState } from "./components/event-form/event-form-schema";
import { fetchEventDraft, saveEventDraft } from "@/lib/supabase-helpers/event-drafts";
import { randomUUID } from "node:crypto";

function save(f: Fixtures, eventId: string, event: Record<string, Json | undefined>) {
  return f.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId, p_event: event, p_slug: null!, p_expected_image_url: null!,
    p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
  });
}
async function going(f: Fixtures, eventId: string) {
  const user = await f.createUser();
  const { error } = await f.supabase.from("event_tickets").insert({ event_id: eventId, user_id: user.id });
  if (error) throw error;
  return user;
}
async function team(f: Fixtures, eventId: string) {
  const user = await going(f, eventId);
  const result = await createTeam(f.supabase, { eventId, userId: user.id });
  expect(result.failureReason).toBeNull();
  return (await fetchUserTeam(f.supabase, eventId, user.id))!;
}
async function stored(f: Fixtures, eventId: string) {
  const result = await f.supabase.from("events").select("teams_enabled,min_team_size,max_team_size,team_deadline,name").eq("id", eventId).single();
  if (result.error) throw result.error;
  return result.data;
}

describe("team form persistence and locks", () => {
  it("round-trips, retains disabled settings, supports clears and preserves tickets and teams on unrelated saves", () => withFixtures(async f => {
    const event = await f.createEvent();
    const config = { teams_enabled: true, min_team_size: 2, max_team_size: 4, team_deadline: "2099-01-01T18:00:00Z" };
    expect((await save(f, event.id, config)).error).toBeNull();
    expect((await save(f, event.id, { teams_enabled: false })).error).toBeNull();
    expect(await stored(f, event.id)).toMatchObject({ ...config, teams_enabled: false, team_deadline: "2099-01-01T18:00:00+00:00" });
    expect((await save(f, event.id, { teams_enabled: true, min_team_size: null, max_team_size: null, team_deadline: null })).error).toBeNull();
    const formed = await team(f, event.id);
    expect((await save(f, event.id, { name: "Unrelated edit" })).error).toBeNull();
    expect(await fetchUserTeam(f.supabase, event.id, formed.owner_id!)).toEqual(formed);
    expect((await f.supabase.from("event_tickets").select("id").eq("event_id", event.id)).data).toHaveLength(1);
    expect(await stored(f, event.id)).toMatchObject({ teams_enabled: true, min_team_size: null, max_team_size: null, team_deadline: null });
  }));

  it("refuses invalid sizes and deadlines atomically but permits elapsed deadlines", () => withFixtures(async f => {
    const event = await f.createEvent();
    for (const input of [{ min_team_size: 0 }, { max_team_size: -1 }, { min_team_size: 5, max_team_size: 4 }, { max_team_size: 1.5 }, { team_deadline: "invalid" }, { team_deadline: "infinity" }]) {
      expect((await save(f, event.id, { ...input, name: "Should roll back" })).error).not.toBeNull();
      expect((await stored(f, event.id)).name).toBe(event.name);
    }
    expect((await save(f, event.id, { teams_enabled: true, team_deadline: "2020-01-01T18:00:00Z" })).error).toBeNull();
  }));

  it("counts ownerless/empty teams, locks disabling, enforces the largest team floor and preserves history", () => withFixtures(async f => {
    const event = await f.createEvent({ teams_enabled: true, max_team_size: 4 });
    const formed = await team(f, event.id);
    const second = await going(f, event.id);
    expect((await joinTeam(f.supabase, { inviteCode: formed.invite_code, userId: second.id })).failureReason).toBeNull();
    expect((await f.supabase.from("teams").insert({ event_id: event.id })).error).toBeNull();
    expect(await fetchEventTeamSettingsInfo(f.supabase, event.id)).toEqual({ teamCount: 2, largestTeam: 2 });
    for (const input of [{ teams_enabled: false }, { max_team_size: 1 }]) {
      const result = await save(f, event.id, { ...input, name: "Should roll back" });
      expect(result.error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
      expect((await stored(f, event.id)).name).toBe(event.name);
    }
    expect((await save(f, event.id, { max_team_size: 2 })).error).toBeNull();
    expect((await fetchUserTeam(f.supabase, event.id, formed.owner_id!))?.members).toHaveLength(2);
    // Removing populated teams still leaves an empty formed team: it locks No.
    expect((await f.supabase.from("teams").delete().eq("id", formed.id)).error).toBeNull();
    expect((await save(f, event.id, { teams_enabled: false })).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
  }));

  it("serializes team creation against disabling", () => withFixtures(async f => {
    for (let i = 0; i < 3; i++) {
      const event = await f.createEvent({ slug: `disable-${i}-${f.tag}`, teams_enabled: true });
      const user = await going(f, event.id);
      const [disabled, created] = await Promise.all([save(f, event.id, { teams_enabled: false }), createTeam(f.supabase, { eventId: event.id, userId: user.id })]);
      const info = await fetchEventTeamSettingsInfo(f.supabase, event.id);
      if (disabled.error) {
        expect(disabled.error.hint).toBe("EVENT_SETTINGS_CONFLICT");
        expect(created.failureReason).toBeNull();
        expect(info.teamCount).toBe(1);
        expect((await stored(f, event.id)).teams_enabled).toBe(true);
      } else {
        expect(created.failureReason).toBe("TEAMS_DISABLED");
        expect(info.teamCount).toBe(0);
      }
    }
  }));

  it("serializes team growth against lowering the maximum", () => withFixtures(async f => {
    for (let i = 0; i < 3; i++) {
      const event = await f.createEvent({ slug: `growth-${i}-${f.tag}`, teams_enabled: true, max_team_size: 2 });
      const formed = await team(f, event.id);
      const user = await going(f, event.id);
      const [lowered, joined] = await Promise.all([save(f, event.id, { max_team_size: 1 }), joinTeam(f.supabase, { inviteCode: formed.invite_code, userId: user.id })]);
      const after = await stored(f, event.id);
      const info = await fetchEventTeamSettingsInfo(f.supabase, event.id);
      expect(info.largestTeam).toBeLessThanOrEqual(after.max_team_size!);
      if (lowered.error) { expect(lowered.error.hint).toBe("EVENT_SETTINGS_CONFLICT"); expect(joined.failureReason).toBeNull(); }
      else expect(joined.failureReason).toBe("TEAM_FULL");
    }
  }));

  it("allows staff aggregate reads, denies nonstaff reads and all browser writes/RPC mutation", () => withFixtures(async f => {
    const event = await f.createEvent({ teams_enabled: true });
    await team(f, event.id);
    for (const role of ["admin", "manager", "basic"] as const) {
      const user = await f.createUser({ role_access: role });
      const client = clientAs(user);
      if (role === "basic") await expect(fetchEventTeamSettingsInfo(client, event.id)).rejects.toMatchObject({ message: "Staff access required." });
      else expect(await fetchEventTeamSettingsInfo(client, event.id)).toEqual({ teamCount: 1, largestTeam: 1 });
      const mutation = await client.rpc("save_admin_event_atomically", { p_event_id: event.id, p_event: { teams_enabled: false }, p_slug: null!, p_expected_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] });
      expect(mutation.error).not.toBeNull();
      expect((await client.from("teams").insert({ event_id: event.id })).error).not.toBeNull();
      expect((await client.from("team_members").insert({ event_id: event.id, team_id: randomUUID(), user_id: user.id })).error).not.toBeNull();
    }
    await expect(fetchEventTeamSettingsInfo(clientAs(null), event.id)).rejects.toBeTruthy();
    const basic = await f.createUser();
    const update = await clientAs(basic).from("events").update({ teams_enabled: false }).eq("id", event.id).select("id");
    expect(update.error || !update.data?.length).toBeTruthy();
    expect((await stored(f, event.id)).teams_enabled).toBe(true);
  }));

  it("persists incomplete team working drafts without applying them to the event", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "draft", teams_enabled: true, min_team_size: 2 });
    const id = randomUUID();
    const doc = { version: 1 as const, formState: { ...defaultFormState, teams_enabled: false, min_team_size: "0", team_deadline: "2099-01-01T" }, checkInEvents: [], applicationTemplate: [], mentors: [], sponsors: [] };
    await saveEventDraft(f.supabase, id, event.id, 0, doc);
    expect((await fetchEventDraft(f.supabase, id))?.document).toEqual(doc);
    expect(await stored(f, event.id)).toMatchObject({ teams_enabled: true, min_team_size: 2 });
  }));
});
