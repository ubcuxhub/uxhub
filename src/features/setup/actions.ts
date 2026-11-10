"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/guards";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { replaceProfilePhoto } from "@/lib/supabase-helpers/admin-user-profile";
import {
  fetchSetupStepByAuthId,
  fetchUserSetup,
  updateUserSetup,
  type UserSetupRow,
} from "@/lib/supabase-helpers/setup";
import type { AvatarPreset, InterestId, SetupStepId } from "./lib/options";
import {
  nextSetupStep,
  resolveSetupDestination,
  toSetupState,
  toSetupStep,
  type SetupState,
} from "./lib/state";
import {
  isSetupStepId,
  parseAvatarPreset,
  parseDietaryNeeds,
  parseInterests,
  type DietaryNeeds,
} from "./lib/validation";

/**
 * Member setup writes. Each acts on the signed-in member's own row only (the
 * id comes from the session, never from the input), returns the saved
 * `SetupState`, and throws on failure. Production hides a thrown message from
 * the browser, so the UI should run the same parsers from `./lib/validation`
 * before calling these.
 *
 * Saving or skipping a step moves `setup_step` to the next one (see
 * `nextSetupStep`); a member who already finished stays `done`.
 */

async function run(
  event: string,
  action: (user: Awaited<ReturnType<typeof requireAuth>>) => Promise<UserSetupRow>
): Promise<SetupState> {
  // Outside the try: requireAuth redirects by throwing, which must reach Next.
  const user = await requireAuth();
  try {
    const row = await action(user);
    // The (app) layout seeds UserProvider with this row.
    revalidatePath("/", "layout");
    return toSetupState(row);
  } catch (error) {
    log.warn(event, { userId: user.id, ...errorFields(error) });
    throw error;
  }
}

/** Step 1. All three lists empty is "I don't have any dietary needs". */
export async function saveSetupDietaryAction(input: DietaryNeeds): Promise<SetupState> {
  return run("setup.dietary_save_failed", async (user) => {
    const needs = parseDietaryNeeds(input);
    return updateUserSetup(await createClient(), user.id, {
      diets: needs.diets,
      allergies: needs.allergies,
      other_allergies: needs.otherAllergies,
      setup_step: nextSetupStep(toSetupStep(user.setup_step), "dietary"),
    });
  });
}

/**
 * Step 2. `avatarPreset` picks a brand shape and removes any uploaded photo;
 * null keeps the photo uploaded through `POST /api/profile-photo`, and fails
 * if there is none.
 */
export async function saveSetupPhotoAction(input: {
  avatarPreset: AvatarPreset | null;
}): Promise<SetupState> {
  return run("setup.photo_save_failed", async (user) => {
    const preset = input?.avatarPreset === null ? null : parseAvatarPreset(input?.avatarPreset);
    const current = await fetchUserSetup(supabaseAdmin, user.id);
    if (preset && current.profile_photo_path) {
      // Compare-and-swap, then deletes the stored object.
      await replaceProfilePhoto(supabaseAdmin, user.id, current.profile_photo_path, null);
    }
    if (!preset && !current.profile_photo_path) {
      throw new Error("Upload a photo or choose an icon.");
    }
    return updateUserSetup(await createClient(), user.id, {
      avatar_preset: preset,
      setup_step: nextSetupStep(toSetupStep(current.setup_step), "photo"),
    });
  });
}

/**
 * Step 3 and the end of setup. Replaces `interests` with the chosen taxonomy
 * ids (an empty list is allowed) and marks setup `done`.
 */
export async function finishSetupAction(input: { interests: InterestId[] }): Promise<SetupState> {
  return run("setup.finish_failed", async (user) => {
    const interests = parseInterests(input?.interests);
    // `interests` has no member grant (managers' free tags share it), so the
    // service role writes it, scoped to the caller's id.
    return updateUserSetup(supabaseAdmin, user.id, { interests, setup_step: "done" });
  });
}

/** "Skip for now": moves past `step` without saving it. Skipping `interests` finishes setup. */
export async function skipSetupStepAction(step: SetupStepId): Promise<SetupState> {
  return run("setup.skip_failed", async (user) => {
    if (!isSetupStepId(step)) throw new Error("Unknown setup step.");
    return updateUserSetup(await createClient(), user.id, {
      setup_step: nextSetupStep(toSetupStep(user.setup_step), step),
    });
  });
}

/**
 * Where to send a member who just signed in with a password: `nextPath` (made
 * safe), or `/portal/setup` when it is the portal home and setup isn't done.
 * Deciding before navigating keeps the portal from flashing. Never throws: any
 * failure falls back to the safe path, and the portal page's own gate remains.
 */
export async function resolvePostSignInPath(nextPath: string): Promise<string> {
  const safePath = getSafeInternalPath(typeof nextPath === "string" ? nextPath : null);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return safePath;
    return resolveSetupDestination(safePath, await fetchSetupStepByAuthId(supabase, user.id));
  } catch (error) {
    log.warn("setup.post_sign_in_lookup_failed", errorFields(error));
    return safePath;
  }
}
