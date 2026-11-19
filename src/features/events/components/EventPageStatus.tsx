import type { ReactNode } from "react";

import { Hubbo } from "@/components/shared/Hubbo";
import { PageContainer } from "@/components/shared/PageContainer";

interface EventPageStatusProps {
  title: string;
  description: ReactNode;
  /** The one next step, a medium primary Button. */
  action: ReactNode;
}

/**
 * Stands in for the portal event page when it can't be shown: it failed to
 * load (Figma 1.19, `error.tsx`) or the event is gone (1.20, `not-found.tsx`).
 * Thinking Hubbo, a Header 2 and a line of body copy over one action, centred
 * in a bordered card under the back pill.
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
