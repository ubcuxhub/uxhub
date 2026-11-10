"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import { Upload } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { AVATAR_PRESET_ART, photoFileError, PHOTO_SOURCE_TYPES } from "../lib/avatar";
import { AVATAR_PRESETS, type AvatarPreset } from "../lib/options";
import { MemberAvatar } from "./MemberAvatar";
import { PhotoCropDialog, type PhotoPick } from "./PhotoCropDialog";

/** What the member has picked: a preset, their uploaded photo, or nothing yet. */
export type AvatarChoice = { kind: "preset"; preset: AvatarPreset } | { kind: "photo" } | null;

const PHOTO_VALUE = "photo";

function toRadioValue(choice: AvatarChoice): string {
  if (!choice) return "";
  return choice.kind === "photo" ? PHOTO_VALUE : choice.preset;
}

interface AvatarPickerProps {
  /** The member's name, for the preview and the avatar's label. */
  name: string;
  choice: AvatarChoice;
  onChoiceChange: (choice: AvatarChoice) => void;
  /** The stored uploaded photo, if any. */
  photoUrl: string | null;
  /**
   * Stores the cropped photo. Resolve once it's saved (the caller then
   * selects it); throw a `PhotoUploadError` to show its message in the crop
   * dialog.
   */
  onUpload: (photo: Blob) => Promise<void>;
  disabled?: boolean;
  /** A form-level error, e.g. nothing chosen. */
  error?: string | null;
  /** Show the preview card (setup) or not (Settings shows the avatar itself). */
  preview?: boolean;
  className?: string;
}

/**
 * Step 2 of setup (Figma 4292:2) and the photo section of Settings: a live
 * preview, the brand-shape presets as a radio group (arrow keys move between
 * them), the member's uploaded photo when there is one, and Upload, which
 * opens the crop dialog.
 */
export function AvatarPicker({
  name,
  choice,
  onChoiceChange,
  photoUrl,
  onUpload,
  disabled,
  error,
  preview = true,
  className,
}: AvatarPickerProps) {
  const legendId = useId();
  const hintId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PhotoPick | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const shownPhoto = choice?.kind === "photo" ? photoUrl : null;
  const shownPreset = choice?.kind === "preset" ? choice.preset : null;

  const closeCrop = () => {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
  };

  return (
    <div data-slot="avatar-picker" className={cn("flex flex-col gap-8", className)}>
      {preview ? (
        <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-section p-4 sm:gap-6 sm:p-6">
          <MemberAvatar name={name} photoUrl={shownPhoto} preset={shownPreset} size="preview" decorative />
          <div className="min-w-0">
            <p className="text-h3 break-words">{name}</p>
            <p className="text-small text-muted-foreground">
              This is how you&apos;ll appear to other members.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <p id={legendId} className="text-body-medium">
          Icons
        </p>
        {/* One row from `sm` (the presets, the photo if any, Upload); rows of four on phones. */}
        <div
          className="grid grid-cols-4 gap-3 sm:grid-cols-[repeat(var(--tiles),minmax(0,1fr))]"
          style={{ "--tiles": AVATAR_PRESETS.length + (photoUrl ? 2 : 1) } as CSSProperties}
        >
          <RadioGroup
            aria-labelledby={legendId}
            aria-describedby={hintId}
            value={toRadioValue(choice)}
            disabled={disabled}
            onValueChange={(value) => {
              setFileError(null);
              onChoiceChange(
                value === PHOTO_VALUE ? { kind: "photo" } : { kind: "preset", preset: value as AvatarPreset },
              );
            }}
            // The tiles sit in the parent grid beside the Upload button.
            className="contents"
          >
            {photoUrl ? (
              <AvatarTile value={PHOTO_VALUE} label="Your photo" src={photoUrl} />
            ) : null}
            {AVATAR_PRESETS.map((preset) => (
              <AvatarTile
                key={preset.id}
                value={preset.id}
                label={preset.label}
                src={AVATAR_PRESET_ART[preset.id]}
              />
            ))}
          </RadioGroup>

          <button
            type="button"
            disabled={disabled}
            aria-describedby={hintId}
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-full border border-dashed border-muted-foreground bg-background text-label text-muted-foreground transition-colors hover:bg-muted focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload aria-hidden className="size-4" />
            {photoUrl ? "Replace" : "Upload"}
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={PHOTO_SOURCE_TYPES.join(",")}
          aria-label="Upload a photo"
          tabIndex={-1}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear it, so choosing the same file again still fires.
            event.target.value = "";
            if (!file) return;
            const problem = photoFileError(file);
            setFileError(problem);
            if (problem) return;
            setPicked({ url: URL.createObjectURL(file), name: file.name });
          }}
        />

        <p id={hintId} className="text-small text-muted-foreground">
          Uploads must be JPG or PNG. You&apos;ll crop it to a circle next.
        </p>
        {fileError || error ? (
          <p role="alert" className="text-small text-destructive">
            {fileError ?? error}
          </p>
        ) : null}
      </div>

      <PhotoCropDialog
        photo={picked}
        onCancel={closeCrop}
        onConfirm={async (cropped) => {
          await onUpload(cropped);
          closeCrop();
        }}
      />
    </div>
  );
}

function AvatarTile({ value, label, src }: { value: string; label: string; src: string }) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      aria-label={label}
      data-slot="avatar-tile"
      className="relative aspect-square cursor-pointer overflow-hidden rounded-full bg-muted transition-shadow focus-visible:focus-ring focus-visible:outline-offset-[6px] disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:ring-3 data-[state=checked]:ring-primary data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-background"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static tiles and a stored photo URL */}
      <img src={src} alt="" className="size-full object-cover" draggable={false} />
    </RadioGroupPrimitive.Item>
  );
}
