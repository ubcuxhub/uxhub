import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { UserInfoRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guard = vi.hoisted(() => ({ requireManager: vi.fn() }));
vi.mock("@/lib/auth/guards", () => guard);

import { saveUserBirthDateAction, saveUserInterestsAction, setStudentVerificationAction, removeUserProfilePhotoAction } from "@/features/admin/user-profile-actions";
import { fetchActiveProfile, replaceProfilePhoto, saveAdminProfile } from "@/lib/supabase-helpers/admin-user-profile";
import { adminDeleteAccount } from "@/lib/supabase-helpers/admin-server";
import { parseProfilePhoto } from "@/features/admin/lib/user-profile";
import { POST } from "@/app/api/admin/users/[userId]/photo/route";
import { NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Only local Supabase is allowed.");
const db = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const png = readFileSync("scripts/seed/data/images/1.png");
const photo = { body: png, ...parseProfilePhoto(png, "image/png") };
let user: UserInfoRow;
let manager: UserInfoRow;
let admin: UserInfoRow;
const authIds: string[] = [];
const profileIds: string[] = [];

async function fixture(role: "basic" | "admin" | "manager") {
  const email = `profile-integration-${randomUUID()}@example.test`;
  const auth = await db.auth.admin.createUser({ email, email_confirm: true });
  if (auth.error) throw auth.error;
  const authId = auth.data.user.id;
  authIds.push(authId);
  const result = await db.from("user_info").insert({ auth_user_id: authId, email, first_name: "Integration", last_name: "Profile", role_access: role }).select().single();
  if (result.error) throw result.error;
  profileIds.push(result.data.id);
  return result.data;
}

// Exercise PostgREST/Storage as real authenticated roles without signing in.
function clientFor(profile: UserInfoRow | null) {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!profile) return createClient<Database>(url, key, { auth: { persistSession: false } });
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: profile.auth_user_id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  const signature = createHmac("sha256", process.env.SUPABASE_TEST_JWT_SECRET!).update(`${header}.${payload}`).digest("base64url");
  return createClient<Database>(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${header}.${payload}.${signature}` } } });
}

beforeEach(async () => {
  user = await fixture("basic"); manager = await fixture("manager"); admin = await fixture("admin");
  guard.requireManager.mockReset().mockResolvedValue(manager);
});
afterEach(async () => {
  for (const id of profileIds) {
    const files = await db.storage.from("profile-photos").list(`profiles/${id}`);
    if (files.data?.length) {
      const removed = await db.storage.from("profile-photos").remove(files.data.map((file) => `profiles/${id}/${file.name}`));
      if (removed.error) throw removed.error;
    }
  }
  if (profileIds.length) {
    const removed = await db.from("user_info").delete().in("id", profileIds);
    if (removed.error) throw removed.error;
  }
  for (const id of authIds) {
    const removed = await db.auth.admin.deleteUser(id);
    if (removed.error && removed.error.status !== 404) throw removed.error;
  }
  authIds.length = 0; profileIds.length = 0;
});

describe("admin profile persistence against local Supabase", () => {
  it("saves, reads and clears birth dates and normalized tags through actions", async () => {
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
  });

  it("records the manager, clears verification on eligibility edits and allows manual clearing", async () => {
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
  });

  it("enforces own-row column restrictions and preserves admin directory reads", async () => {
    for (const profile of [user, admin, manager]) {
      const client = clientFor(profile);
      for (const patch of [{ birth_date: "2000-01-01" }, { interests: ["Design"] }, { profile_photo_path: null }, { student_verified_at: new Date().toISOString(), student_verified_by: manager.id }]) {
        expect((await client.from("user_info").update(patch).eq("id", user.id)).error).toBeTruthy();
      }
    }
    const own = await clientFor(user).from("user_info").select("id").eq("id", user.id);
    expect(own.error).toBeNull(); expect(own.data).toHaveLength(1);
    const visible = await clientFor(admin).from("user_info").select("id").eq("id", user.id);
    expect(visible.error).toBeNull(); expect(visible.data).toHaveLength(1);
    const hidden = await clientFor(null).from("user_info").select("id").eq("id", user.id);
    expect(hidden.data ?? []).toHaveLength(0);
  });

  it("uploads publicly, replaces and removes photos; stale saves clean up their upload", async () => {
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
  });

  it("allows only one of two concurrent replacements", async () => {
    const results = await Promise.allSettled([replaceProfilePhoto(db, user.id, null, photo), replaceProfilePhoto(db, user.id, null, photo)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.storage.from("profile-photos").list(`profiles/${user.id}`)).data).toHaveLength(1);
  });

  it("denies client storage writes/deletes and enforces bucket MIME and size limits", async () => {
    const saved = await replaceProfilePhoto(db, user.id, null, photo);
    for (const profile of [null, user, admin, manager]) {
      const storage = clientFor(profile).storage.from("profile-photos");
      expect((await storage.upload(`profiles/${user.id}/${randomUUID()}.png`, png, { contentType: "image/png" })).error).toBeTruthy();
      await storage.remove([saved.profile_photo_path!]);
      expect((await db.storage.from("profile-photos").download(saved.profile_photo_path!)).error).toBeNull();
    }
    const storage = db.storage.from("profile-photos");
    expect((await storage.upload(`profiles/${user.id}/${randomUUID()}.txt`, Buffer.from("text"), { contentType: "text/plain" })).error).toBeTruthy();
    expect((await storage.upload(`profiles/${user.id}/${randomUUID()}.png`, Buffer.alloc(4194305), { contentType: "image/png" })).error).toBeTruthy();
  });

  it("handles upload route validation and persists accepted photos", async () => {
    const form = new FormData(); form.set("expectedPath", ""); form.set("file", new File([png], "photo.png", { type: "image/png" }));
    const response = await POST(new NextRequest(`${url}/api/admin/users/${user.id}/photo`, { method: "POST", body: form }), { params: Promise.resolve({ userId: user.id }) });
    expect(response.status).toBe(200);
    expect((await response.json()).user.profile_photo_path).toBeTruthy();
    const invalid = new FormData(); invalid.set("expectedPath", ""); invalid.set("file", new File(["invalid"], "photo.png", { type: "image/png" }));
    expect((await POST(new NextRequest(`${url}/test`, { method: "POST", body: invalid }), { params: Promise.resolve({ userId: user.id }) })).status).toBe(400);
  });

  it("requires manager authorization for every action and upload route", async () => {
    guard.requireManager.mockRejectedValue(new Error("Manager required"));
    await expect(saveUserBirthDateAction(user.id, "2000-01-01")).rejects.toThrow("Manager required");
    await expect(saveUserInterestsAction(user.id, ["Design"])).rejects.toThrow("Manager required");
    await expect(setStudentVerificationAction(user.id, true)).rejects.toThrow("Manager required");
    await expect(removeUserProfilePhotoAction(user.id, null)).rejects.toThrow("Manager required");
    await expect(POST(new NextRequest(`${url}/test`, { method: "POST" }), { params: Promise.resolve({ userId: user.id }) })).rejects.toThrow("Manager required");
    expect(await fetchActiveProfile(db, user.id)).toMatchObject({ birth_date: null, interests: [], student_verified_at: null });
  });

  it("anonymizes all new fields, removes the photo and rejects later writes", async () => {
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
  });
});
