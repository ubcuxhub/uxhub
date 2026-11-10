"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { openSettings } from "@/features/settings/components/SettingsDialog";
import { dismissProfileNudgeAction } from "../profile-nudge-actions";

/**
 * Asks a member who never chose interests to add them in Settings › Profile.
 * Optional, so it is an Alert (not an ActionBanner) and can be dismissed. The
 * server decides whether to render it; either button hides it right away and
 * sets a cookie so it stays gone ("Add interests" also opens Settings).
 * Width matches the membership and discount cards below it.
 */
export function ProfileNudge() {
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;

  return (
    <Alert variant="info" icon={<Info aria-hidden />} className="mb-6 max-w-[490px]">
      <AlertTitle>Complete your profile</AlertTitle>
      <AlertDescription>
        Add your interests so we can plan events you&rsquo;ll enjoy.
      </AlertDescription>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            setHidden(true);
            void dismissProfileNudgeAction();
            openSettings("profile");
          }}
        >
          Add interests
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setHidden(true);
            void dismissProfileNudgeAction();
          }}
        >
          Not now
        </Button>
      </div>
    </Alert>
  );
}
