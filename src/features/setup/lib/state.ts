import type { UserInfoRow } from "@/lib/supabase/models";
import type { UserSetupRow } from "@/lib/supabase-helpers/setup";
import {
  SETUP_STEPS,
  type AllergyId,
  type AvatarPreset,
  type DietId,
  type SetupStep,
  type SetupStepId,
} from "./options";
import { isSetupStep } from "./validation";

/** Where setup lives. Built by the setup UI under `(app)/(setup)`. */
export const SETUP_PATH = "/portal/setup";

/**
 * The only pages that send an unfinished member to setup. Just the portal
 * home, where sign-in lands: checkout, membership, event, admin and API routes
 * are never gated, so setup can't stand between a member and a registration
 * or purchase, and a deep link (`?next=`) goes straight through.
 */
export const SETUP_GATED_PATHS: readonly string[] = ["/portal"];

/** The setup columns of `user_info`, as setup reads them. */
export interface SetupState {
  step: SetupStep;
  diets: DietId[];
  allergies: AllergyId[];
  otherAllergies: string[];
  avatarPreset: AvatarPreset | null;
  profilePhotoPath: string | null;
  interests: string[];
}

export type SetupRow = UserSetupRow;

/** A value the database would reject reads as `done`: setup never blocks. */
export function toSetupStep(value: string | null | undefined): SetupStep {
  return isSetupStep(value) ? value : "done";
}

export function toSetupState(row: SetupRow): SetupState {
  return {
    step: toSetupStep(row.setup_step),
    // The CHECK constraints hold these to the option ids.
    diets: row.diets as DietId[],
    allergies: row.allergies as AllergyId[],
    otherAllergies: row.other_allergies,
    avatarPreset: row.avatar_preset as AvatarPreset | null,
    profilePhotoPath: row.profile_photo_path,
    interests: row.interests,
  };
}

/**
 * The step to resume at after `completed` was saved or skipped. A member who
 * already finished stays finished, so revisiting setup never re-arms the gate.
 */
export function nextSetupStep(current: SetupStep, completed: SetupStepId): SetupStep {
  if (current === "done") return "done";
  return SETUP_STEPS[SETUP_STEPS.indexOf(completed) + 1] ?? "done";
}

/**
 * The gate: where to send a signed-in member instead of `pathname`, or null to
 * let the page render. Only members whose setup isn't `done` (new sign-ups who
 * haven't finished or skipped it; existing members were backfilled as done),
 * and only on `SETUP_GATED_PATHS`.
 */
export function getSetupRedirect(
  user: Pick<UserInfoRow, "setup_step">,
  pathname: string
): string | null {
  if (!SETUP_GATED_PATHS.includes(pathname)) return null;
  return toSetupStep(user.setup_step) === "done" ? null : SETUP_PATH;
}

export type AvatarSource =
  | { kind: "photo"; path: string }
  | { kind: "preset"; preset: AvatarPreset }
  | { kind: "initials" };

/** An uploaded photo wins over a preset; with neither, show initials. */
export function resolveAvatar(
  user: Pick<UserInfoRow, "profile_photo_path" | "avatar_preset">
): AvatarSource {
  if (user.profile_photo_path) return { kind: "photo", path: user.profile_photo_path };
  if (user.avatar_preset) return { kind: "preset", preset: user.avatar_preset as AvatarPreset };
  return { kind: "initials" };
}
