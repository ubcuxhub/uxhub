/**
 * UBC email verification against the local database: the three code-flow
 * functions, their row lock, the scrub trigger, the one-verified-account
 * index and the grandfathering backfill. See
 * docs/design/ubc-email-verification.md.
 */
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));

const {
  beginUbcCodeAttempt,
  claimUbcCodeSend,
  completeUbcCodeVerification,
  fetchPendingUbcCode,
} = await import("./ubc-verification");

const db = createIntegrationClient();
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

async function student(fixtures: Fixtures, label: string, overrides: Partial<Database["public"]["Tables"]["user_info"]["Insert"]> = {}) {
  return fixtures.createUser({
    user_type: "ubcStudent",
    ubc_email: `${fixtures.tag}-${label}@student.ubc.ca`,
    ...overrides,
  });
}

function claim(userId: string, email: string) {
  return claimUbcCodeSend(db, { userId, email, codeHash: randomBytes(32), salt: randomBytes(16) });
}

async function codeRow(userId: string) {
  const { data, error } = await db.from("ubc_verification_codes").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function backdateCode(userId: string, patch: Database["public"]["Tables"]["ubc_verification_codes"]["Update"]) {
  const { error } = await db.from("ubc_verification_codes").update(patch).eq("user_id", userId);
  if (error) throw error;
}

async function profile(userId: string) {
  const { data, error } = await db
    .from("user_info")
    .select("ubc_email, ubc_verified_at, ubc_verified_via, ubc_verified_by")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function update(userId: string, patch: Database["public"]["Tables"]["user_info"]["Update"]) {
  const { error } = await db.from("user_info").update(patch).eq("id", userId);
  if (error) throw error;
}

/** Sends a code and reads back the send it made, as the verify action does. */
async function sendAndBegin(userId: string, email: string) {
  expect((await claim(userId, email)).result).toBe("ok");
  const attempt = await beginUbcCodeAttempt(db, { userId, email });
  expect(attempt.result).toBe("ok");
  return attempt.challengeSentAt!;
}

describe("claim_ubc_code_send", () => {
  it("lets exactly one of two concurrent sends through; the other waits out the cooldown", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "race");
      const results = await Promise.all([claim(user.id, user.ubc_email!), claim(user.id, user.ubc_email!)]);
      expect(results.map((result) => result.result).sort()).toEqual(["cooldown", "ok"]);
      const cooldown = results.find((result) => result.result === "cooldown")!;
      // A live code exists, so the UI can treat it as sent.
      expect(cooldown.expiresAt).not.toBeNull();
      expect(cooldown.resendAt).not.toBeNull();
    }));

  it("lifts the cooldown after 60 seconds and caps sends at five a day", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "cap");
      const email = user.ubc_email!;
      for (let send = 1; send <= 5; send++) {
        expect((await claim(user.id, email)).result).toBe("ok");
        // At the cap, the cap is the answer rather than a countdown to it.
        expect((await claim(user.id, email)).result).toBe(send < 5 ? "cooldown" : "daily_cap");
        await backdateCode(user.id, { last_sent_at: ago(61_000) });
      }
      const capped = await claim(user.id, email);
      expect(capped.result).toBe("daily_cap");
      expect(new Date(capped.resendAt!).getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);

      // The window rolls over after 24 hours.
      await backdateCode(user.id, { window_started_at: ago(DAY + 1000) });
      expect((await claim(user.id, email)).result).toBe("ok");
      expect((await codeRow(user.id))?.sends_in_window).toBe(1);
    }));

  it("counts per member, so switching addresses doesn't skip the cooldown", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "switch");
      expect((await claim(user.id, user.ubc_email!)).result).toBe("ok");
      const other = `${fixtures.tag}-other@student.ubc.ca`;
      await update(user.id, { ubc_email: other });
      expect((await claim(user.id, other)).result).toBe("cooldown");
    }));

  it("refuses an address that isn't the saved one, one already verified here, or one held elsewhere", () =>
    withFixtures(async (fixtures) => {
      const holder = await student(fixtures, "holder", { ubc_verified_at: ago(DAY), ubc_verified_via: "code" });
      const user = await student(fixtures, "taker");
      expect((await claim(user.id, `${fixtures.tag}-nope@student.ubc.ca`)).result).toBe("mismatch");
      expect((await claim(holder.id, holder.ubc_email!)).result).toBe("already_verified");

      await update(user.id, { ubc_email: holder.ubc_email });
      expect((await claim(user.id, holder.ubc_email!)).result).toBe("taken");
    }));
});

describe("begin_ubc_code_attempt", () => {
  it("locks after five tries until a new send", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "tries");
      const email = user.ubc_email!;
      expect((await claim(user.id, email)).result).toBe("ok");
      for (let left = 4; left >= 0; left--) {
        expect(await beginUbcCodeAttempt(db, { userId: user.id, email })).toMatchObject({ result: "ok", attemptsLeft: left });
      }
      expect((await beginUbcCodeAttempt(db, { userId: user.id, email })).result).toBe("locked");
      expect((await fetchPendingUbcCode(db, user.id))?.attemptsLeft).toBe(0);

      await backdateCode(user.id, { last_sent_at: ago(61_000) });
      expect((await claim(user.id, email)).result).toBe("ok");
      expect((await beginUbcCodeAttempt(db, { userId: user.id, email })).result).toBe("ok");
    }));

  it("lets exactly five of eight concurrent guesses through", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "parallel");
      const email = user.ubc_email!;
      expect((await claim(user.id, email)).result).toBe("ok");
      const results = await Promise.all(
        Array.from({ length: 8 }, () => beginUbcCodeAttempt(db, { userId: user.id, email })),
      );
      expect(results.filter((result) => result.result === "ok")).toHaveLength(5);
      expect(results.filter((result) => result.result === "locked")).toHaveLength(3);
      expect((await codeRow(user.id))?.attempts).toBe(5);
    }));

  it("answers none, expired and stale", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "states");
      const email = user.ubc_email!;
      expect((await beginUbcCodeAttempt(db, { userId: user.id, email })).result).toBe("none");
      expect((await claim(user.id, email)).result).toBe("ok");
      await backdateCode(user.id, { expires_at: ago(1000) });
      expect((await beginUbcCodeAttempt(db, { userId: user.id, email })).result).toBe("expired");
      expect(await fetchPendingUbcCode(db, user.id)).toBeNull();

      const moved = `${fixtures.tag}-moved@student.ubc.ca`;
      await update(user.id, { ubc_email: moved });
      expect((await beginUbcCodeAttempt(db, { userId: user.id, email: moved })).result).toBe("stale");
    }));
});

describe("complete_ubc_code_verification", () => {
  it("stamps the code, then answers already_verified, and nulls the code", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "complete");
      const email = user.ubc_email!;
      const sentAt = await sendAndBegin(user.id, email);

      expect(await completeUbcCodeVerification(db, { userId: user.id, email, challengeSentAt: sentAt })).toBe("verified");
      expect(await profile(user.id)).toMatchObject({ ubc_email: email, ubc_verified_via: "code", ubc_verified_by: null });
      expect(await completeUbcCodeVerification(db, { userId: user.id, email, challengeSentAt: sentAt })).toBe("already_verified");
      expect(await codeRow(user.id)).toMatchObject({ code_hash: null, code_salt: null, expires_at: null, sends_in_window: 1 });
    }));

  it("refuses a code from a superseded send", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "superseded");
      const email = user.ubc_email!;
      const sentAt = await sendAndBegin(user.id, email);
      await backdateCode(user.id, { last_sent_at: ago(61_000) });
      expect((await claim(user.id, email)).result).toBe("ok");
      expect(await completeUbcCodeVerification(db, { userId: user.id, email, challengeSentAt: sentAt })).toBe("stale");
      expect((await profile(user.id)).ubc_verified_at).toBeNull();
    }));

  it("refuses once the saved address changed", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "changed");
      const email = user.ubc_email!;
      const sentAt = await sendAndBegin(user.id, email);
      await update(user.id, { ubc_email: `${fixtures.tag}-new@student.ubc.ca` });
      expect(await completeUbcCodeVerification(db, { userId: user.id, email, challengeSentAt: sentAt })).toBe("stale");
    }));

  it("releases a hold over a year old, and the index blocks a live one", () =>
    withFixtures(async (fixtures) => {
      const stale = await student(fixtures, "stale-holder", { ubc_verified_at: ago(366 * DAY), ubc_verified_via: "code" });
      const user = await student(fixtures, "claimant");
      const email = stale.ubc_email!;
      await update(user.id, { ubc_email: email });

      const sentAt = await sendAndBegin(user.id, email);
      expect(await completeUbcCodeVerification(db, { userId: user.id, email, challengeSentAt: sentAt })).toBe("verified");
      expect(await profile(stale.id)).toMatchObject({ ubc_email: email, ubc_verified_at: null, ubc_verified_via: null });

      // Now held by `user`: a third account can't take it, by code or directly.
      const third = await student(fixtures, "third");
      await update(third.id, { ubc_email: email });
      expect((await claim(third.id, email)).result).toBe("taken");
      const { error } = await db
        .from("user_info")
        .update({ ubc_verified_at: new Date().toISOString(), ubc_verified_via: "manual" })
        .eq("id", third.id);
      expect(error?.code).toBe("23505");
    }));

  it("maps a race to the index as taken", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "race-a");
      const rival = await student(fixtures, "race-b");
      const email = user.ubc_email!;
      await update(rival.id, { ubc_email: email });
      const sentAt = await sendAndBegin(user.id, email);
      // The rival is stamped by an exec between the send and the completion.
      await update(rival.id, { ubc_verified_at: new Date().toISOString(), ubc_verified_via: "manual" });
      expect(await completeUbcCodeVerification(db, { userId: user.id, email, challengeSentAt: sentAt })).toBe("taken");
    }));
});

describe("scrub_ubc_verification", () => {
  it("clears a code stamp when the address or the type changes", () =>
    withFixtures(async (fixtures) => {
      const verified = { ubc_verified_at: ago(DAY), ubc_verified_via: "code" } as const;
      const byEmail = await student(fixtures, "scrub-email", verified);
      await update(byEmail.id, { ubc_email: `${fixtures.tag}-scrubbed@student.ubc.ca` });
      expect((await profile(byEmail.id)).ubc_verified_at).toBeNull();

      const byType = await student(fixtures, "scrub-type", verified);
      await update(byType.id, { user_type: "faculty" });
      expect((await profile(byType.id)).ubc_verified_via).toBeNull();
    }));

  it("clears a manual stamp when the student number changes, but not a code stamp", () =>
    withFixtures(async (fixtures) => {
      const manager = await fixtures.createUser({ role_access: "manager" });
      const manual = await student(fixtures, "scrub-manual", {
        student_number: 38475610,
        ubc_verified_at: ago(DAY),
        ubc_verified_via: "manual",
        ubc_verified_by: manager.id,
      });
      await update(manual.id, { student_number: 38475611 });
      expect(await profile(manual.id)).toMatchObject({ ubc_verified_at: null, ubc_verified_by: null });

      const coded = await student(fixtures, "keep-code", { student_number: 38475610, ubc_verified_at: ago(DAY), ubc_verified_via: "code" });
      await update(coded.id, { student_number: 38475611 });
      expect((await profile(coded.id)).ubc_verified_via).toBe("code");
    }));

  it("keeps a stamp written in the same update as the address", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "same-update", { ubc_verified_at: ago(DAY), ubc_verified_via: "code" });
      const email = `${fixtures.tag}-signin@student.ubc.ca`;
      await update(user.id, { ubc_email: email, ubc_verified_at: new Date().toISOString(), ubc_verified_via: "sign_in_email" });
      expect(await profile(user.id)).toMatchObject({ ubc_email: email, ubc_verified_via: "sign_in_email" });
    }));

  it("scrubs the address and drops the pending code on account deletion", () =>
    withFixtures(async (fixtures) => {
      const user = await student(fixtures, "deleted");
      expect((await claim(user.id, user.ubc_email!)).result).toBe("ok");
      const { error } = await db.rpc("delete_account", { p_auth_user_id: user.auth_user_id! });
      expect(error).toBeNull();
      expect(await profile(user.id)).toEqual({ ubc_email: null, ubc_verified_at: null, ubc_verified_via: null, ubc_verified_by: null });
      expect(await codeRow(user.id)).toBeNull();
    }));
});

describe("grandfather_ubc_members", () => {
  it("stamps active and pending UBC members only, keeping their address as found", () =>
    withFixtures(async (fixtures) => {
      const tier = await fixtures.createMembershipType();
      const future = new Date(Date.now() + 30 * DAY).toISOString();
      const active = await student(fixtures, "gf-active", { membership_type_id: tier.id, membership_expires_at: future });
      const noAddress = await student(fixtures, "gf-bare", { ubc_email: null, membership_type_id: tier.id, membership_expires_at: future });
      const pending = await fixtures.createUser({ user_type: "faculty", membership_pre_ordered_type_id: tier.id });
      const lapsed = await student(fixtures, "gf-lapsed", { membership_type_id: tier.id, membership_expires_at: ago(DAY) });
      const nonUbc = await fixtures.createUser({ user_type: "nonUbc", membership_type_id: tier.id, membership_expires_at: future });
      const coded = await student(fixtures, "gf-coded", {
        membership_type_id: tier.id,
        membership_expires_at: future,
        ubc_verified_at: ago(DAY),
        ubc_verified_via: "code",
      });

      const { data: count, error } = await db.rpc("grandfather_ubc_members");
      expect(error).toBeNull();
      expect(count).toBeGreaterThanOrEqual(3);

      expect(await profile(active.id)).toMatchObject({ ubc_verified_via: "grandfathered", ubc_email: active.ubc_email });
      expect(await profile(noAddress.id)).toMatchObject({ ubc_verified_via: "grandfathered", ubc_email: null });
      expect((await profile(pending.id)).ubc_verified_via).toBe("grandfathered");
      expect((await profile(lapsed.id)).ubc_verified_via).toBeNull();
      expect((await profile(nonUbc.id)).ubc_verified_via).toBeNull();
      expect((await profile(coded.id)).ubc_verified_via).toBe("code");
    }));
});
