"use client";

import * as React from "react";
import { X } from "lucide-react";

import { ActionBanner } from "@/components/ui/action-banner";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { openSettings } from "@/features/settings/components/SettingsDialog";
import { dismissProfileNudgeAction } from "../profile-nudge-actions";

/**
 * Asks a member who never chose interests to add them in Settings › Profile.
 * The server decides whether to render it; dismissing hides it right away and
 * sets a cookie so it stays gone.
 */
export function ProfileNudge() {
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;

  return (
    <ActionBanner
      title="Complete your profile"
      className="mb-6"
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openSettings("profile")}>
            Add interests
          </Button>
          <IconButton
            label="Dismiss"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setHidden(true);
              void dismissProfileNudgeAction();
            }}
          >
            <X aria-hidden />
          </IconButton>
        </div>
      }
    >
      Add your interests so we can plan events you&rsquo;ll enjoy.
    </ActionBanner>
  );
}
