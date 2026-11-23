import Link from "next/link";
import type { ReactNode } from "react";

import { Hubbo } from "@/components/shared/Hubbo";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";

const CONTACT_EMAIL = "ubcuxhub@gmail.com";

interface EventPageStatusProps {
  title: string;
  description: ReactNode;
  /** The one next step, a medium primary Button. */
  action: ReactNode;
}

/**
 * Stands in for the portal event page when it can't be shown: it failed to
 * load (Figma 1.19, `error.tsx`), it can't be found (`not-found.tsx`) or it was
 * unpublished (1.20, `EventRemovedStatus`). Thinking Hubbo, a Header 2 and a
 * line of body copy over one action, centred in a bordered card under the back
 * pill.
 *
 * Not `EmptyState`: these are whole-page states, so the heading is the page's
 * h1 at Header 2 size and the copy is body size, where `EmptyState` sets a
 * card's subheading and small text.
 */
export function EventPageStatus({ title, description, action }: EventPageStatusProps) {
  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events">
      <section className="flex flex-col items-center gap-5 rounded-xl border border-border bg-card px-6 py-12 text-center sm:px-8 sm:py-16">
        <Hubbo emotion="thinking" className="h-40" />
        <div className="flex max-w-120 flex-col gap-2">
          <h1 className="text-h2 text-foreground">{title}</h1>
          <p className="text-body text-muted-foreground">{description}</p>
        </div>
        {action}
      </section>
    </PageContainer>
  );
}

export function BrowseEventsButton() {
  return (
    <Button asChild>
      <Link href="/portal/events">Browse events</Link>
    </Button>
  );
}

/**
 * The event was published, then moved back to draft (Figma 1.20). The portal
 * event page renders this only when `adminIsUnpublishedEvent` says so. Every
 * other missing event gets the neutral `not-found.tsx`, since a deleted row
 * can't be told apart from a mistyped link.
 */
export function EventRemovedStatus() {
  return (
    <EventPageStatus
      title="This event is no longer available"
      description={
        <>
          {"The UX Hub team removed it, so its page and tickets are gone. You don’t need to do anything. Questions about a ticket you paid for? Email the UX Hub team at "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </>
      }
      action={<BrowseEventsButton />}
    />
  );
}
