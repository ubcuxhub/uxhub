"use client";

import { useId, type ReactNode } from "react";

import { AutosaveStatus } from "@/features/applications/components/AutosaveStatus";
import type { AutosaveState } from "@/features/applications/lib/autosave";
import { cn } from "@/lib/utils";

interface ProfileSectionProps {
  title: string;
  description?: ReactNode;
  /** A badge beside the title: "Not answered", "4 selected". */
  meta?: ReactNode;
  /** This section's autosave. Idle shows nothing; the tab says once that changes save. */
  saveState?: AutosaveState;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * One group of the Profile tab. In a wide pane (the desktop dialog) the
 * heading sits in a left column beside the fields, the way `SettingsRow` puts
 * a title beside its control; narrower, it stacks above them. Sized by the
 * `profile` container, not the viewport, because the dialog's sidebar takes
 * part of the width.
 */
export function ProfileSection({
  title,
  description,
  meta,
  saveState,
  onRetry,
  children,
  className,
}: ProfileSectionProps) {
  const headingId = useId();
  const showStatus = saveState && saveState.kind !== "idle";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "grid gap-5 border-t border-border-subtle py-8 @2xl/profile:grid-cols-[12rem_minmax(0,1fr)] @2xl/profile:gap-10",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-subheading">
            {title}
          </h3>
          {meta}
        </div>
        {description ? (
          <p className="text-small text-pretty text-muted-foreground">{description}</p>
        ) : null}
        {/* A section never goes back to idle once edited, so the status (and
            its live region) stays mounted from the first change on. The
            reserved line keeps the wide layout from jumping when it appears;
            stacked, it takes no room until there is something to say. */}
        <div className={cn("min-h-5 pt-1", !showStatus && "@max-2xl/profile:hidden")}>
          {showStatus ? (
            <AutosaveStatus state={saveState} onRetry={onRetry ?? (() => {})} />
          ) : null}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
