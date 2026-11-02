"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { toast, ToastView, type ToastOptions } from "@/components/ui/toast";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

const noop = () => {};

type Fire = (message: string, options?: ToastOptions) => string | number;

/**
 * Fires the toast an `?open=` state names, kept until dismissed so it can be
 * screenshotted. Fixed ids make a double mount (Strict Mode) replace rather
 * than stack.
 */
function OpenToasts({ open }: SectionProps) {
  useEffect(() => {
    const ids: (string | number)[] = [];
    const fire = (
      fn: Fire,
      message: string,
      id: string,
      extra: ToastOptions = {},
    ) => {
      ids.push(fn(message, { id, duration: Infinity, ...extra }));
    };
    const saved = {
      description: "UXathon is now live on Events.",
    };
    const failed = {
      description: "Check your connection and try again.",
      action: { label: "Try again", onClick: noop },
    };
    if (open === "toast-success") {
      fire(toast.success, "Event published", "open-success", saved);
    } else if (open === "toast-error") {
      fire(toast.error, "Couldn’t save changes", "open-error", failed);
    } else if (open === "toast-neutral") {
      fire(toast, "Draft saved", "open-neutral");
    } else if (open === "toast-stack") {
      fire(toast.success, "Event published", "open-stack-1", saved);
      fire(toast, "Draft saved", "open-stack-2");
      fire(toast.error, "Couldn’t save changes", "open-stack-3", failed);
    }
    return () => ids.forEach((id) => toast.dismiss(id));
  }, [open]);
  return null;
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full flex-col gap-3 rounded-2xl bg-section p-4 sm:p-7"
      style={{ "--width": "min(380px, 100%)" } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function ToastDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <OpenToasts open={open} />

      <SpecimenGroup
        title="Toast"
        spec="§3.8"
        min="min(22rem, 100%)"
        description="Bottom right, stacked, 380px, dismissed after 5s. Tones are Success, Neutral and Error; one optional action. Hover or focus pauses the timer, Alt+T moves focus into the stack."
      >
        <Specimen label="Success, with description" bare>
          <Stage>
            <ToastView
              tone="success"
              message="Event published"
              description="UXathon is now live on Events."
              onDismiss={noop}
            />
          </Stage>
        </Specimen>
        <Specimen label="Neutral, title only" bare>
          <Stage>
            <ToastView tone="neutral" message="Draft saved" onDismiss={noop} />
          </Stage>
        </Specimen>
        <Specimen label="Error, with action" bare>
          <Stage>
            <ToastView
              tone="error"
              message="Couldn’t save changes"
              description="Check your connection and try again."
              action={{ label: "Try again", onClick: noop }}
              onDismiss={noop}
            />
          </Stage>
        </Specimen>
        <Specimen label="Long copy wraps" bare>
          <Stage>
            <ToastView
              tone="error"
              message="Couldn’t confirm your spot for the UXathon 2026 design sprint"
              description="The confirmation window closed at 11:59 PM. Email the team and we’ll sort it out."
              onDismiss={noop}
            />
          </Stage>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Toast, live"
        spec="§3.8"
        description="Fires through the real Toaster in the page corner. Fire several to see the stack of three."
      >
        <Specimen label="Fire a toast" wide>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.success("Event published")}
          >
            Success
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.success("Event published", {
                description: "UXathon is now live on Events.",
              })
            }
          >
            Success + description
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast("Draft saved")}
          >
            Neutral
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.error("Couldn’t save changes", {
                description: "Check your connection and try again.",
                action: {
                  label: "Try again",
                  onClick: () => toast.success("Saved"),
                },
              })
            }
          >
            Error + action
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast("Syncing…", { id: "sync", description: "Same id replaces." })
            }
          >
            Replace by id
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast.dismiss()}>
            Dismiss all
          </Button>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default ToastDemo;
