/**
 * Member setup's server actions and photo route against the local database,
 * acting as a member through `clientAs`: each step saved or skipped, the
 * resume point, the user type answer and when it may change, the
 * photo/preset swap, and what setup can't write.
 */
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";
import {
  fetchUserSetup,
  updateUserSetup,
  updateUserTypeIfMembershipUnchanged,
} from "@/lib/supabase-helpers/setup";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ member: null as UserInfoRow | null }));
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(async () => {
    if (!session.member) throw new Error("No member signed in.");
    return session.member;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientAs(session.member)),
}));

import { POST } from "@/app/api/profile-photo/route";
import { saveMembershipProfileAction } from "@/features/memberships/actions";
import { USER_TYPE_LOCKED_MESSAGE } from "./lib/state";
import {
  finishSetupAction,
  saveSetupAboutAction,
  saveSetupDietaryAction,
  saveSetupPhotoAction,
  skipSetupStepAction,
} from "./actions";

const db = createIntegrationClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const png = readFileSync("scripts/seed/data/images/1.png");

/** A new member, signed in, as a fresh request would load them. */
async function signUp(fixtures: Fixtures) {
  const member = await fixtures.createUser();
  fixtures.trackStorage("profile-photos", `profiles/${member.id}`);
  session.member = member;
  return member;
}

/** The next request's `requireAuth()` reads the row afresh. */
async function nextRequest(id: string) {
  const { data, error } = await db.from("user_info").select("*").eq("id", id).single();
  if (error) throw error;
  session.member = data;
}

/** Sets up a row the way a purchase or an earlier answer would have. */
async function setColumns(id: string, patch: Partial<UserInfoRow>) {
  const { error } = await db.from("user_info").update(patch).eq("id", id);
  if (error) throw error;
}

function upload(expectedPath: string, body: BlobPart = new Uint8Array(png)) {
  const form = new FormData();
  form.set("expectedPath", expectedPath);
  form.set("file", new File([body], "photo.png", { type: "image/png" }));
  return POST(new NextRequest(`${url}/api/profile-photo`, { method: "POST", body: form }));
}

describe("member setup against local Supabase", () => {
  it("starts new members at step 1 and walks every step to done", () => withFixtures(async (fixtures) => {
    const member = await signUp(fixtures);
    expect(member).toMatchObject({ setup_step: "about", user_type: "ubcStudent", user_type_confirmed_at: null });

    // Confirming the default type is an answer too.
    const about = await saveSetupAboutAction({ userType: "ubcStudent" });
    expect(about).toMatchObject({ ok: true, setup: { step: "dietary", userType: "ubcStudent", userTypeConfirmed: true } });

    await nextRequest(member.id);
    const dietary = await saveSetupDietaryAction({
      diets: ["vegan", "vegan"],
      allergies: ["peanuts"],
      otherAllergies: [" Sesame ", "sesame", ""],
    });
    expect(dietary).toMatchObject({
      step: "photo",
      diets: ["vegan"],
      allergies: ["peanuts"],
      otherAllergies: ["Sesame"],
    });
    // The legacy column follows, for code that still reads it.
    const { data: legacy } = await db.from("user_info").select("dietary_restrictions").eq("id", member.id).single();
    expect(legacy?.dietary_restrictions).toBe("Sesame");

    await nextRequest(member.id);
    const photo = await saveSetupPhotoAction({ avatarPreset: "starburst" });
    expect(photo).toMatchObject({ step: "interests", avatarPreset: "starburst", profilePhotoPath: null });

    await nextRequest(member.id);
    const done = await finishSetupAction({ interests: ["ux-research", "uxathon", "mentorship"] });
    expect(done).toMatchObject({ step: "done", interests: ["ux-research", "uxathon", "mentorship"] });

    // Revisiting a step after finishing never re-arms the gate.
    await nextRequest(member.id);
    expect((await saveSetupDietaryAction({ diets: [], allergies: [], otherAllergies: [] })).step).toBe("done");
    expect((await fetchUserSetup(db, member.id)).other_allergies).toEqual([]);
  }));

  it("skips each step without saving and resumes where the member left off", () => withFixtures(async (fixtures) => {
    const member = await signUp(fixtures);
    expect((await skipSetupStepAction("about")).step).toBe("dietary");
    await nextRequest(member.id);
    expect((await fetchUserSetup(db, member.id)).user_type_confirmed_at).toBeNull();
    expect((await skipSetupStepAction("dietary")).step).toBe("photo");
    await nextRequest(member.id);
    expect((await skipSetupStepAction("photo")).step).toBe("interests");
    await nextRequest(member.id);
    const done = await skipSetupStepAction("interests");
    expect(done).toMatchObject({ step: "done", diets: [], avatarPreset: null, interests: [] });
    await nextRequest(member.id);
    await expect(skipSetupStepAction("welcome" as never)).rejects.toThrow("Unknown setup step");
  }));

  it("swaps between an uploaded photo and a preset, keeping one", () => withFixtures(async (fixtures) => {
    const member = await signUp(fixtures);
    await saveSetupPhotoAction({ avatarPreset: "flower" }).then(() => nextRequest(member.id));
    // "Use this photo" with nothing uploaded is refused.
    await updateUserSetup(db, member.id, { avatar_preset: null });
    await nextRequest(member.id);
    await expect(saveSetupPhotoAction({ avatarPreset: null })).rejects.toThrow("Upload a photo");
    await updateUserSetup(db, member.id, { avatar_preset: "flower" });

    const uploaded = await upload("");
    expect(uploaded.status).toBe(200);
    const { setup } = await uploaded.json();
    expect(setup.profilePhotoPath).toMatch(new RegExp(`^profiles/${member.id}/`));
    expect(setup.avatarPreset).toBeNull();
    expect((await upload("")).status).toBe(409);
    expect((await upload(setup.profilePhotoPath, "not an image")).status).toBe(400);

    await nextRequest(member.id);
    expect(await saveSetupPhotoAction({ avatarPreset: null })).toMatchObject({
      profilePhotoPath: setup.profilePhotoPath,
      avatarPreset: null,
    });

    // Choosing a preset removes the uploaded photo and its stored object.
    await nextRequest(member.id);
    expect(await saveSetupPhotoAction({ avatarPreset: "sparkle" })).toMatchObject({
      profilePhotoPath: null,
      avatarPreset: "sparkle",
    });
    expect((await db.storage.from("profile-photos").list(`profiles/${member.id}`)).data).toHaveLength(0);
  }));

  it("rejects values outside the lists and writes only the member's own row", () => withFixtures(async (fixtures) => {
    const other = await fixtures.createUser();
    const member = await signUp(fixtures);
    await expect(saveSetupDietaryAction({ diets: ["paleo" as never], allergies: [], otherAllergies: [] })).rejects.toThrow("diets");
    await expect(saveSetupDietaryAction({ diets: [], allergies: [], otherAllergies: ["x".repeat(201)] })).rejects.toThrow();
    await expect(saveSetupPhotoAction({ avatarPreset: "hubbo" as never })).rejects.toThrow("icon");
    await expect(finishSetupAction({ interests: ["Free tag" as never] })).rejects.toThrow("interests");
    await expect(saveSetupAboutAction({ userType: "alumni" as never })).rejects.toThrow("best describes you");
    expect((await fetchUserSetup(db, member.id)).setup_step).toBe("about");

    // The member's own client reaches only their row, and never interests.
    const client = clientAs(member);
    await expect(updateUserSetup(client, other.id, { diets: ["vegan"] })).rejects.toThrow();
    await expect(updateUserSetup(client, member.id, { interests: ["ux-research"] })).rejects.toBeTruthy();
    expect((await updateUserSetup(client, member.id, { diets: ["kosher"] })).diets).toEqual(["kosher"]);
    expect((await fetchUserSetup(db, other.id)).diets).toEqual([]);
  }));

  it("changes the user type without a membership, clearing the old type's details", () => withFixtures(async (fixtures) => {
    // Its own tier, made before the member who references it: CI's database is unseeded.
    const tier = (await fixtures.createMembershipType()).id;
    const member = await signUp(fixtures);
    // A lapsed membership no longer holds the type.
    await setColumns(member.id, {
      student_number: 12345678,
      faculty: "Faculty of Arts",
      major: "Design",
      year: "2",
      membership_type_id: tier,
      membership_expires_at: "2020-04-30T07:00:00+00:00",
    });
    await nextRequest(member.id);

    const result = await saveSetupAboutAction({ userType: "nonUbc" });
    expect(result).toMatchObject({ ok: true, setup: { step: "dietary", userType: "nonUbc", userTypeConfirmed: true } });
    const { data: row } = await db.from("user_info").select("*").eq("id", member.id).single();
    expect(row).toMatchObject({
      user_type: "nonUbc",
      student_number: null,
      faculty: null,
      major: null,
      // Both types own a year, as in Settings (`buildEligibilityUpdate`).
      year: "2",
      membership_type_id: tier,
    });
    expect(row?.user_type_confirmed_at).not.toBeNull();
  }));

  it("refuses a new user type while a membership is pending, but lets the member confirm theirs", () => withFixtures(async (fixtures) => {
    const tier = await fixtures.createMembershipType();
    const member = await signUp(fixtures);
    await setColumns(member.id, { membership_pre_ordered_type_id: tier.id });
    await nextRequest(member.id);

    expect(await saveSetupAboutAction({ userType: "faculty" })).toEqual({ ok: false, error: USER_TYPE_LOCKED_MESSAGE });
    expect(await fetchUserSetup(db, member.id)).toMatchObject({
      user_type: "ubcStudent",
      user_type_confirmed_at: null,
      setup_step: "about",
    });

    // A membership bought after the check also stops the write.
    const stale = { ...member, membership_pre_ordered_type_id: null };
    expect(await updateUserTypeIfMembershipUnchanged(db, stale, { user_type: "faculty" })).toBeNull();
    expect((await fetchUserSetup(db, member.id)).user_type).toBe("ubcStudent");

    expect(await saveSetupAboutAction({ userType: "ubcStudent" })).toMatchObject({
      ok: true,
      setup: { step: "dietary", userType: "ubcStudent", userTypeConfirmed: true },
    });
  }));

  it("records the answer when membership join saves the details", () => withFixtures(async (fixtures) => {
    const member = await signUp(fixtures);
    expect(await saveMembershipProfileAction({
      audience: "non-ubc",
      schoolInstitution: "SFU",
      studentStatus: "undergraduate",
      year: "",
    })).toEqual({ ok: true, verification: "verified" });
    const saved = await fetchUserSetup(db, member.id);
    expect(saved).toMatchObject({ user_type: "nonUbc", setup_step: "about" });
    expect(saved.user_type_confirmed_at).not.toBeNull();
  }));

  it("requires a signed-in member", () => withFixtures(async () => {
    session.member = null;
    await expect(skipSetupStepAction("dietary")).rejects.toThrow("No member signed in");
    await expect(finishSetupAction({ interests: [] })).rejects.toThrow("No member signed in");
    await expect(saveSetupAboutAction({ userType: "faculty" })).rejects.toThrow("No member signed in");
  }));
});
