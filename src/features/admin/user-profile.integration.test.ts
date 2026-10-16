import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guard = vi.hoisted(() => ({ requireManager: vi.fn() }));
vi.mock("@/lib/auth/guards", () => guard);

import { POST } from "@/app/api/admin/users/[userId]/photo/route";
import { parseProfilePhoto } from "@/features/admin/lib/user-profile";
import {
  removeUserProfilePhotoAction, saveUserBirthDateAction,
  saveUserInterestsAction, setStudentVerificationAction,
} from "@/features/admin/user-profile-actions";
import { adminDeleteAccount } from "@/lib/supabase-helpers/admin-server";
import { fetchActiveProfile, replaceProfilePhoto, saveAdminProfile } from "@/lib/supabase-helpers/admin-user-profile";

const db = createIntegrationClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const png = readFileSync("scripts/seed/data/images/1.png");
const photo = { body: png, ...parseProfilePhoto(png, "image/png") };

interface Profiles { user: UserInfoRow; manager: UserInfoRow; admin: UserInfoRow }

/** A basic member, a manager the guard resolves to, and an admin, all removed afterwards. */
function withProfiles(fn: (profiles: Profiles, fixtures: Fixtures) => Promise<void>) {
  return withFixtures(async (fixtures) => {
    const profiles = {
      user: await fixtures.createUser(),
      manager: await fixtures.createUser({ role_access: "manager" }),
      admin: await fixtures.createUser({ role_access: "admin" }),
    };
    for (const profile of Object.values(profiles)) {
      fixtures.trackStorage("profile-photos", `profiles/${profile.id}`);
    }
    guard.requireManager.mockReset().mockResolvedValue(profiles.manager);
    await fn(profiles, fixtures);
  });
}

describe("admin profile persistence against local Supabase", () => {
  it("saves, reads and clears birth dates and normalized tags through actions", () => withProfiles(async ({ user }) => {
    await saveUserBirthDateAction(user.id, "2000-02-29");
    await saveUserInterestsAction(user.id, [" Design ", "design", "Research"]);
    const saved = await fetchActiveProfile(db, user.id);
    expect(saved.birth_date).toBe("2000-02-29");
    expect(saved.interests).toEqual(["Design", "Research"]);
    await expect(saveUserBirthDateAction(user.id, "2001-02-29")).rejects.toThrow("valid birth date");
    await expect(saveUserBirthDateAction(user.id, "2999-01-01")).rejects.toThrow("future");
    await expect(saveUserInterestsAction(user.id, [" "])).rejects.toThrow();
    await expect(saveUserInterestsAction(user.id, Array.from({ length: 21 }, (_, i) => `tag${i}`))).rejects.toThrow();
    expect((await db.from("user_info").update({ birth_date: "2999-01-01" }).eq("id", user.id)).error).toBeTruthy();
    expect((await db.from("user_info").update({ interests: ["Design", "design"] }).eq("id", user.id)).error).toBeTruthy();
    await saveUserBirthDateAction(user.id, null); await saveUserInterestsAction(user.id, []);
    expect(await fetchActiveProfile(db, user.id)).toMatchObject({ birth_date: null, interests: [] });
  }));

  it("records the manager, clears verification on eligibility edits and allows manual clearing", () => withProfiles(async ({ user, manager }) => {
    const verified = await setStudentVerificationAction(user.id, true);
    expect(verified.student_verified_by).toBe(manager.id);
    expect(verified.student_verified_at).toBeTruthy();
    await saveAdminProfile(db, user.id, { student_number: 12345678 });
    expect(await fetchActiveProfile(db, user.id)).toMatchObject({ student_verified_at: null, student_verified_by: null });
    await setStudentVerificationAction(user.id, true);
    await saveAdminProfile(db, user.id, { user_type: "nonUbc" });
    expect((await fetchActiveProfile(db, user.id)).student_verified_at).toBeNull();
    await setStudentVerificationAction(user.id, true);
    expect((await setStudentVerificationAction(user.id, false)).student_verified_at).toBeNull();
  }));

  it("enforces own-row column restrictions and preserves admin directory reads", () => withProfiles(async ({ user, manager, admin }) => {
    for (const profile of [user, admin, manager]) {
      const client = clientAs(profile);
      for (const patch of [{ birth_date: "2000-01-01" }, { interests: ["Design"] }, { profile_photo_path: null }, { student_verified_at: new Date().toISOString(), student_verified_by: manager.id }]) {
        expect((await client.from("user_info").update(patch).eq("id", user.id)).error).toBeTruthy();
      }
    }
    const own = await clientAs(user).from("user_info").select("id").eq("id", user.id);
    expect(own.error).toBeNull(); expect(own.data).toHaveLength(1);
    const visible = await clientAs(admin).from("user_info").select("id").eq("id", user.id);
    expect(visible.error).toBeNull(); expect(visible.data).toHaveLength(1);
    const hidden = await clientAs(null).from("user_info").select("id").eq("id", user.id);
    expect(hidden.data ?? []).toHaveLength(0);
  }));

  it("uploads publicly, replaces and removes photos; stale saves clean up their upload", () => withProfiles(async ({ user }) => {
    const first = await replaceProfilePhoto(db, user.id, null, photo);
    expect(first.profile_photo_path).toContain(`profiles/${user.id}/`);
    const publicUrl = db.storage.from("profile-photos").getPublicUrl(first.profile_photo_path!).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(true);
    await expect(replaceProfilePhoto(db, user.id, null, photo)).rejects.toThrow("Reload");
    const listed = await db.storage.from("profile-photos").list(`profiles/${user.id}`);
    expect(listed.data).toHaveLength(1);
    const second = await replaceProfilePhoto(db, user.id, first.profile_photo_path, photo);
    expect(second.profile_photo_path).not.toBe(first.profile_photo_path);
    expect((await db.storage.from("profile-photos").download(first.profile_photo_path!)).error).toBeTruthy();
    await removeUserProfilePhotoAction(user.id, second.profile_photo_path);
    expect((await fetchActiveProfile(db, user.id)).profile_photo_path).toBeNull();
    expect((await db.storage.from("profile-photos").list(`profiles/${user.id}`)).data).toHaveLength(0);
  }));

  it("allows only one of two concurrent replacements", () => withProfiles(async ({ user }) => {
    const results = await Promise.allSettled([replaceProfilePhoto(db, user.id, null, photo), replaceProfilePhoto(db, user.id, null, photo)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.storage.from("profile-photos").list(`profiles/${user.id}`)).data).toHaveLength(1);
  }));

  it("denies client storage writes/deletes and enforces bucket MIME and size limits", () => withProfiles(async ({ user, manager, admin }) => {
    const saved = await replaceProfilePhoto(db, user.id, null, photo);
    for (const profile of [null, user, admin, manager]) {
      const storage = clientAs(profile).storage.from("profile-photos");
      expect((await storage.upload(`profiles/${user.id}/${randomUUID()}.png`, png, { contentType: "image/png" })).error).toBeTruthy();
      await storage.remove([saved.profile_photo_path!]);
      expect((await db.storage.from("profile-photos").download(saved.profile_photo_path!)).error).toBeNull();
    }
    const storage = db.storage.from("profile-photos");
    expect((await storage.upload(`profiles/${user.id}/${randomUUID()}.txt`, Buffer.from("text"), { contentType: "text/plain" })).error).toBeTruthy();
    expect((await storage.upload(`profiles/${user.id}/${randomUUID()}.png`, Buffer.alloc(4194305), { contentType: "image/png" })).error).toBeTruthy();
  }));

  it("handles upload route validation and persists accepted photos", () => withProfiles(async ({ user }) => {
    const form = new FormData(); form.set("expectedPath", ""); form.set("file", new File([png], "photo.png", { type: "image/png" }));
    const response = await POST(new NextRequest(`${url}/api/admin/users/${user.id}/photo`, { method: "POST", body: form }), { params: Promise.resolve({ userId: user.id }) });
    expect(response.status).toBe(200);
    expect((await response.json()).user.profile_photo_path).toBeTruthy();
    const invalid = new FormData(); invalid.set("expectedPath", ""); invalid.set("file", new File(["invalid"], "photo.png", { type: "image/png" }));
    expect((await POST(new NextRequest(`${url}/test`, { method: "POST", body: invalid }), { params: Promise.resolve({ userId: user.id }) })).status).toBe(400);
    const stale = new FormData(); stale.set("expectedPath", ""); stale.set("file", new File([png], "photo.png", { type: "image/png" }));
    expect((await POST(new NextRequest(`${url}/test`, { method: "POST", body: stale }), { params: Promise.resolve({ userId: user.id }) })).status).toBe(409);
  }));

  it("requires manager authorization for every action and upload route", () => withProfiles(async ({ user }) => {
    guard.requireManager.mockRejectedValue(new Error("Manager required"));
    await expect(saveUserBirthDateAction(user.id, "2000-01-01")).rejects.toThrow("Manager required");
    await expect(saveUserInterestsAction(user.id, ["Design"])).rejects.toThrow("Manager required");
    await expect(setStudentVerificationAction(user.id, true)).rejects.toThrow("Manager required");
    await expect(removeUserProfilePhotoAction(user.id, null)).rejects.toThrow("Manager required");
    await expect(POST(new NextRequest(`${url}/test`, { method: "POST" }), { params: Promise.resolve({ userId: user.id }) })).rejects.toThrow("Manager required");
    expect(await fetchActiveProfile(db, user.id)).toMatchObject({ birth_date: null, interests: [], student_verified_at: null });
  }));

  it("anonymizes all new fields, removes the photo and rejects later writes", () => withProfiles(async ({ user }) => {
    await saveUserBirthDateAction(user.id, "2000-01-01"); await saveUserInterestsAction(user.id, ["Design"]); await setStudentVerificationAction(user.id, true);
    const saved = await replaceProfilePhoto(db, user.id, null, photo);
    const stalePath = `profiles/${user.id}/${randomUUID()}.png`;
    const staleUpload = await db.storage.from("profile-photos").upload(stalePath, png, { contentType: "image/png" });
    expect(staleUpload.error).toBeNull();
    await adminDeleteAccount(user.auth_user_id!);
    const deleted = await db.from("user_info").select().eq("id", user.id).single();
    expect(deleted.data).toMatchObject({ birth_date: null, interests: [], student_verified_at: null, student_verified_by: null, profile_photo_path: null });
    expect(deleted.data?.deleted_at).toBeTruthy();
    expect((await db.storage.from("profile-photos").download(saved.profile_photo_path!)).error).toBeTruthy();
    expect((await db.storage.from("profile-photos").list(`profiles/${user.id}`)).data).toHaveLength(0);
    await expect(saveUserBirthDateAction(user.id, "2000-01-01")).rejects.toThrow();
    await expect(replaceProfilePhoto(db, user.id, null, photo)).rejects.toThrow();
  }));
});
