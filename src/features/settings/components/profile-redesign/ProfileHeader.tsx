"use client";

import { Camera } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/setup/components/MemberAvatar";
import type { AvatarPreset } from "@/features/setup/lib/options";

import { membershipLabel, type MembershipSummary } from "./model";

interface ProfileHeaderProps {
  name: string;
  email: string;
  /** What the avatar shows now: `resolveAvatar`'s photo, else preset, else initials. */
  photoUrl: string | null;
  preset: AvatarPreset | null;
  membership: MembershipSummary;
  /** "Admin" or "Manager"; null for members. */
  role: string | null;
  /** Whether the photo chooser below the header is open. */
  photoOpen: boolean;
  onPhotoToggle: () => void;
  /** The id of the photo chooser, for `aria-controls`. */
  photoPanelId: string;
}

/**
 * Who this profile is, before any field: the avatar as others see it, the
 * name, the sign-in email, and membership at a glance. The photo button opens
 * the chooser in place rather than in a second dialog (one overlay at a time,
 * §3.7); only the crop step is a dialog, as in setup.
 */
export function ProfileHeader({
  name,
  email,
  photoUrl,
  preset,
  membership,
  role,
  photoOpen,
  onPhotoToggle,
  photoPanelId,
}: ProfileHeaderProps) {
  const hasPicture = Boolean(photoUrl || preset);

  return (
    <header className="flex flex-col gap-4 @md/profile:flex-row @md/profile:items-center @md/profile:gap-5">
      <div className="flex min-w-0 flex-1 items-center gap-4 @md/profile:gap-5">
        <MemberAvatar
          name={name}
          photoUrl={photoUrl}
          preset={preset}
          size={64}
          decorative
          className="@md/profile:size-20 @md/profile:text-[28px]"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-h3 break-words">{name}</p>
          <p className="text-small break-all text-muted-foreground">{email}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <Badge
              variant={
                membership.kind === "active"
                  ? "success"
                  : membership.kind === "pending"
                    ? "warning"
                    : "neutral"
              }
            >
              {membershipLabel(membership)}
            </Badge>
            {role ? <Badge variant="tag">{role}</Badge> : null}
            {membership.kind === "active" && membership.expiresOn ? (
              <span className="text-label font-normal text-muted-foreground">
                Until {membership.expiresOn}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-expanded={photoOpen}
        aria-controls={photoPanelId}
        onClick={onPhotoToggle}
        className="self-start @md/profile:self-center"
      >
        <Camera />
        {hasPicture ? "Change photo" : "Add photo"}
      </Button>
    </header>
  );
}
