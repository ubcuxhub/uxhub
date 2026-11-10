import { createClient } from "@/lib/supabase/client";
import { BUCKETS } from "@/lib/supabase-helpers/buckets";

import {
  finishSetupAction,
  saveSetupDietaryAction,
  saveSetupPhotoAction,
  skipSetupStepAction,
} from "../actions";
import type { AvatarPreset, InterestId, SetupStepId } from "../lib/options";
import type { SetupState } from "../lib/state";
import type { DietaryNeeds } from "../lib/validation";

/**
 * Everything the setup screens send to the server, behind one interface so
 * the dev templates and tests can run the real UI on fixture data.
 */
export interface SetupClient {
  saveDietary: (input: DietaryNeeds) => Promise<SetupState>;
  savePhoto: (input: { avatarPreset: AvatarPreset | null }) => Promise<SetupState>;
  finish: (input: { interests: InterestId[] }) => Promise<SetupState>;
  skip: (step: SetupStepId) => Promise<SetupState>;
  /** Stores a cropped photo now (it replaces any preset). Throws `PhotoUploadError`. */
  uploadPhoto: (photo: Blob, expectedPath: string | null) => Promise<SetupState>;
  /** The public URL for a stored `profile_photo_path`. */
  photoUrl: (path: string | null) => string | null;
}

/** An upload the route refused, with copy that's safe to show. */
export class PhotoUploadError extends Error {}

export async function uploadProfilePhoto(
  photo: Blob,
  expectedPath: string | null,
): Promise<SetupState> {
  const form = new FormData();
  form.set("file", photo, photo.type === "image/png" ? "photo.png" : "photo.jpg");
  form.set("expectedPath", expectedPath ?? "");
  let response: Response;
  try {
    response = await fetch("/api/profile-photo", { method: "POST", body: form });
  } catch {
    throw new PhotoUploadError("Couldn't upload your photo. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as
    | { setup?: SetupState; error?: string }
    | null;
  if (response.ok && body?.setup) return body.setup;
  throw new PhotoUploadError(
    response.status === 409
      ? "Your photo changed in another tab. Reload the page and try again."
      : body?.error || "Couldn't upload your photo. Try again.",
  );
}

export function profilePhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return createClient().storage.from(BUCKETS.profilePhotos).getPublicUrl(path).data.publicUrl;
}

export const serverSetupClient: SetupClient = {
  saveDietary: saveSetupDietaryAction,
  savePhoto: saveSetupPhotoAction,
  finish: finishSetupAction,
  skip: skipSetupStepAction,
  uploadPhoto: uploadProfilePhoto,
  photoUrl: profilePhotoUrl,
};

/** Production hides a server action's message, so failures get one plain line. */
export const SAVE_FAILED = "Couldn't save. Check your connection and try again.";
