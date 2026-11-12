"use client";

import { useId, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";

import { RecordField } from "@/components/shared/RecordDrawer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BUCKETS } from "@/lib/supabase-helpers/buckets";

import { PROFILE_PHOTO_MAX_BYTES } from "../lib/user-profile";
import type { UserEditDraft } from "../lib/user-edit";

export type PhotoDraft = UserEditDraft["photo"];

/** The public URL of a stored profile photo. */
export function profilePhotoUrl(path: string | null | undefined) {
  if (!path) return null;
  return createClient().storage.from(BUCKETS.profilePhotos).getPublicUrl(path).data.publicUrl;
}

/**
 * The photo a record shows: the staged one while editing (`null` once
 * removal is staged), otherwise the saved one.
 */
export function displayedPhotoUrl(savedPath: string | null | undefined, draft: PhotoDraft) {
  if (draft === null) return null;
  if (draft) return draft.preview;
  return profilePhotoUrl(savedPath);
}

interface UserAvatarFieldProps {
  name: string;
  /** What the record shows now (see `displayedPhotoUrl`). */
  photoUrl: string | null;
  disabled?: boolean;
  /** A new file to upload on save (`{ file, preview }`), or `null` to remove the photo on save. */
  onChange: (photo: NonNullable<PhotoDraft> | null) => void;
}

/**
 * The profile photo row while editing a user. Nothing is uploaded until the
 * record is saved: choosing a file stages a preview, and Remove stages the
 * removal.
 */
export function UserAvatarField({ name, photoUrl, disabled, onChange }: UserAvatarFieldProps) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <RecordField
      label="Photo"
      description="JPEG or PNG, up to 4 MiB. Profile photos are public."
      error={error}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Avatar key={photoUrl ?? "none"} name={name} src={photoUrl} size={40} decorative />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
        >
          <ImageUp aria-hidden />
          {photoUrl ? "Change photo" : "Upload photo"}
        </Button>
        {photoUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setError(null);
            }}
          >
            <Trash2 aria-hidden />
            Remove photo
          </Button>
        ) : null}
        <input
          ref={fileInput}
          id={inputId}
          aria-label="Profile photo"
          type="file"
          accept="image/jpeg,image/png"
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = "";
            if (!chosen || disabled) return;
            if (!["image/jpeg", "image/png"].includes(chosen.type) || chosen.size > PROFILE_PHOTO_MAX_BYTES) {
              setError("Choose a JPEG or PNG up to 4 MiB.");
              return;
            }
            onChange({ file: chosen, preview: URL.createObjectURL(chosen) });
            setError(null);
          }}
        />
      </div>
    </RecordField>
  );
}
