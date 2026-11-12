import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface ApplicationSectionProps {
  id: string;
  number: number;
  title: string;
  description?: ReactNode;
  complete?: boolean;
  /** Classes for the bordered card that holds the content. */
  cardClassName?: string;
  children: ReactNode;
}

/**
 * One numbered section of the application page: "Section 2", its heading and
 * line, a Complete badge once done, then a bordered card. Sections after the
 * first are divided by a rule.
 */
export function ApplicationSection({
  id,
  number,
  title,
  description,
  complete,
  cardClassName,
  children,
}: ApplicationSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="flex scroll-mt-40 flex-col gap-4 border-border [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-10 sm:[&:not(:first-child)]:pt-14"
    >
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="min-w-0">
          <p className="text-badge text-muted-foreground">Section {number}</p>
          <h2 id={headingId} className="pt-1 text-h3">
            {title}
          </h2>
          {description ? (
            <p className="pt-0.5 text-body text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {complete ? <StatusBadge label="Complete" tone="success" status="going" /> : null}
      </div>
      <div
        className={cn(
          "flex flex-col gap-8 rounded-xl border border-border bg-background p-5",
          cardClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
