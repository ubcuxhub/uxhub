"use client";

import { useEffect } from "react";
import { Calendar, CalendarX, CloudOff, SearchX } from "lucide-react";

import { ActionBanner } from "@/components/ui/action-banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast, ToastView, type ToastOptions } from "@/components/ui/toast";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const OPEN_STATES = [
  "toast-success",
  "toast-error",
  "toast-neutral",
  "toast-stack",
] as const;

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

function Framed({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-border">{children}</div>
  );
}

function Feedback({ open }: SectionProps) {
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

      <SpecimenGroup
        title="ActionBanner"
        spec="§3.8, §4.3"
        min="min(24rem, 100%)"
        description="At the top of Home or an event page, one at a time. The button names the step. Not an alert: it is present at load and does not interrupt."
      >
        <Specimen label="Accepted, with action" bare wide>
          <ActionBanner
            className="w-full"
            title="You’re accepted to Design Sprint."
            action={<Button size="sm">Confirm spot</Button>}
          >
            Confirm your spot by Nov 14.
          </ActionBanner>
        </Specimen>
        <Specimen label="Join banner" bare wide>
          <ActionBanner
            className="w-full"
            title="Become a member"
            action={<Button size="sm">Join UX Hub</Button>}
          >
            Get member pricing and priority on event applications.
          </ActionBanner>
        </Specimen>
        <Specimen label="No action" bare wide>
          <ActionBanner className="w-full" title="Application submitted.">
            We’ll email you when decisions are out.
          </ActionBanner>
        </Specimen>
        <Specimen label="Long copy" bare>
          <ActionBanner
            className="w-full"
            title="You’re accepted to the UXathon 2026 design sprint with a very long title that wraps"
            action={<Button size="sm">Confirm spot</Button>}
          >
            Confirm your spot by Nov 14 at 11:59 PM Pacific, or we’ll offer it
            to the next person on the waitlist.
          </ActionBanner>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="EmptyState"
        spec="§3.8, §4.4f"
        min="min(22rem, 100%)"
        description="Say what goes here and offer the next step. No error colours, no blame, even when loading failed."
      >
        <Specimen label="card (default), empty" bare>
          <Framed>
            <EmptyState
              icon={<Calendar />}
              title="No upcoming events"
              description="New events show up here as soon as they’re published."
              actions={
                <Button variant="secondary" size="sm">
                  View past events
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="card, no results" bare>
          <Framed>
            <EmptyState
              icon={<SearchX />}
              title="No events match “portfolo”"
              description="Check the spelling or try a different word."
              actions={
                <Button variant="secondary" size="sm">
                  Clear search
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="card, load failed" bare>
          <Framed>
            <EmptyState
              icon={<CloudOff />}
              title="Couldn’t load events"
              description="Check your connection and try again."
              actions={
                <Button variant="secondary" size="sm">
                  Try again
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="card, not found" bare>
          <Framed>
            <EmptyState
              icon={<CalendarX />}
              title="This event isn’t available"
              description="It may have been removed, or the link is wrong."
              actions={
                <Button variant="secondary" size="sm">
                  Back to Events
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="page (py-16), two actions" bare wide>
          <Framed>
            <EmptyState
              size="page"
              titleAs="h2"
              icon={<Calendar />}
              title="No upcoming events"
              description="New events show up here as soon as they’re published."
              actions={
                <>
                  <Button size="sm">Browse past events</Button>
                  <Button variant="secondary" size="sm">
                    Subscribe
                  </Button>
                </>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="inline (no media)" bare>
          <Framed>
            <EmptyState
              size="inline"
              title="Nothing on right now"
              description="Check back during the event."
            />
          </Framed>
        </Specimen>
        <Specimen label="inline, title only" bare>
          <Framed>
            <EmptyState size="inline" title="No applications yet" />
          </Framed>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Banner above an empty list"
        description="The page keeps its title, the banner sits on top, and the empty state fills the card."
      >
        <div className="flex flex-col gap-4">
          <ActionBanner
            title="You’re accepted to Design Sprint."
            action={<Button size="sm">Confirm spot</Button>}
          >
            Confirm your spot by Nov 14.
          </ActionBanner>
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState
              icon={<Calendar />}
              title="No upcoming events"
              description="New events show up here as soon as they’re published."
            />
          </div>
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "feedback",
  title: "Feedback",
  group: "Feedback",
  description: "A Toast confirms what just happened, an ActionBanner asks for a next step, an EmptyState fills a list with nothing in it.",
  spec: "§3.8",
  layout: "split",
  openStates: OPEN_STATES,
  Component: Feedback,
};

export default section;
