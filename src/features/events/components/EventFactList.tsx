import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatEventDate } from "@/lib/date";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

/** One row of an event's key facts: an icon, a line, and an optional muted line under it. */
export interface EventFact {
  key: string;
  icon: LucideIcon;
  /** What the row is ("Date and time"), for screen readers; the icon stands in for it on screen. */
  term: string;
  value: ReactNode;
  detail?: ReactNode;
}

/**
 * The key facts at the top of the public event page (date, location, price,
 * registration), as a definition list so each value keeps its name for
 * assistive technology.
 */
export function EventFactList({ facts, className }: { facts: EventFact[]; className?: string }) {
  if (!facts.length) return null;
  return (
    <dl className={cn("flex flex-col gap-4", className)}>
      {facts.map(({ key, icon: Icon, term, value, detail }) => (
        <div key={key} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3">
          <dt className={cn("flex size-10 items-center justify-center rounded-md border border-border-subtle bg-background text-muted-foreground", detail && "row-span-2")}>
            <Icon className="size-5" aria-hidden />
            <span className="sr-only">{term}</span>
          </dt>
          {/* A lone line centres on the icon; with a detail, both lines start at its top. */}
          <dd className={cn("min-w-0 break-words text-body-medium", !detail && "self-center")}>{value}</dd>
          {detail && <dd className="min-w-0 break-words text-small text-muted-foreground">{detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** The price line, with the member price under it when members pay something else. */
export function priceFact(
  regular: number | null | undefined,
  member: number | null | undefined,
): Pick<EventFact, "value" | "detail"> {
  if (regular == null) return { value: "Price to be confirmed" };
  const price = Number(regular);
  const memberPrice = member == null ? null : Number(member);
  return {
    value: formatPrice(price),
    detail: memberPrice !== null && memberPrice !== price ? `${formatPrice(memberPrice)} for UX Hub members` : undefined,
  };
}

/** The page's registration window, from the event's state (`eventStateFor`). */
export type RegistrationWindow = "upcoming" | "open" | "closed" | "full";

/** "Sat, Dec 6", in Pacific time. */
const shortDate = (value: string) => formatEventDate(value, { weekday: "short", month: "short", year: undefined });

/**
 * What the registration row says, or `null` when it would only repeat the
 * button ("Registration Closed", "Event Full"). The row adds what the button
 * doesn't: when the window opens or closes, the seats left, and whether
 * attendees apply first.
 */
export function registrationFact({
  window,
  opensAt,
  closesAt,
  spotsLeft,
  capacity,
  requiresApplication,
}: {
  window: RegistrationWindow;
  opensAt: string | null;
  closesAt: string | null;
  /** `null` when the event has no capacity: no limit, so no count. */
  spotsLeft: number | null;
  capacity: number | null;
  requiresApplication: boolean;
}): Pick<EventFact, "value" | "detail"> | null {
  const applicationNote = requiresApplication ? "Application required" : undefined;
  if (window === "upcoming") {
    const opens = requiresApplication ? "Applications open" : "Registration opens";
    return { value: `${opens} ${opensAt ? shortDate(opensAt) : "soon"}`, detail: applicationNote };
  }
  if (window !== "open") return null;
  const value = closesAt
    ? `${requiresApplication ? "Apply" : "Register"} by ${shortDate(closesAt)}`
    : requiresApplication ? "Applications open" : "Registration open";
  // Application events take applicants, not a first-come count, so seats only
  // show without one, and only when there's a limit to count down to.
  const seats = !requiresApplication && capacity != null && spotsLeft !== null
    ? `${spotsLeft} of ${capacity} spots left`
    : undefined;
  return { value, detail: applicationNote ?? seats };
}
