import { useId } from "react";
import type { ReactNode } from "react";
import { Scan } from "lucide-react";

interface ScanTicketsCardProps {
  /** One line of context: the check-in item and its time. */
  description: ReactNode;
  /** The Scan tickets button first, then any secondary action. */
  children: ReactNode;
}

/** The check-in page's way into the scanner. */
export function ScanTicketsCard({ description, children }: ScanTicketsCardProps) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className="flex flex-col gap-4 rounded-xl bg-info px-5 py-4 sm:flex-row sm:items-center sm:px-6 sm:py-5">
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-foreground">
        <Scan className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 id={titleId} className="text-h3">Scan tickets</h3>
        <p className="text-small text-muted-foreground [overflow-wrap:anywhere]">{description}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 *:flex-1 sm:shrink-0 sm:*:flex-none">{children}</div>
  </section>;
}
