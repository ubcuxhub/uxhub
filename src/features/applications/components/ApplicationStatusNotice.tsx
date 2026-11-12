import Link from "next/link";
import { PencilLine } from "lucide-react";

import { FlowLink } from "@/components/shared/FlowLink";
import { ActionBanner } from "@/components/ui/action-banner";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusBadgeSpec } from "@/components/ui/status-badge";
import { formatEventDate } from "@/lib/date";

import type { ApplicationCallout } from "../lib/application-callout";

interface ApplicationStatusNoticeProps {
  callout: ApplicationCallout;
  eventName: string;
  eventSlug: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
}

const shortDate = (value: string | null) =>
  formatEventDate(value, { month: "short", year: undefined }) ?? undefined;
const longDate = (value: string | null) => formatEventDate(value) ?? undefined;

/**
 * The member's application status on the portal event page: Apply, Continue
 * application, Pending, Accepted (Register by, then Register), Waitlisted,
 * Not selected, or that applications are closed. Only Accepted asks for a
 * step with a deadline, so only it is an ActionBanner (design system §4.3).
 */
export function ApplicationStatusNotice({
  callout,
  eventName,
  eventSlug,
  registrationOpensAt,
  registrationClosesAt,
}: ApplicationStatusNoticeProps) {
  const applyHref = `/portal/events/${eventSlug}/apply`;

  if (callout.kind === "accepted") {
    return (
      <ActionBanner
        title={`You’re accepted to ${eventName}.`}
        action={
          <Button asChild size="sm">
            <FlowLink href={`/portal/events/${eventSlug}/checkout`}>Register</FlowLink>
          </Button>
        }
      >
        Register by {longDate(callout.offerExpiresAt)} to keep your spot.
      </ActionBanner>
    );
  }

  const closes = longDate(registrationClosesAt);
  const content: {
    badge: StatusBadgeSpec;
    text: string;
    action?: { label: string; primary?: boolean };
  } = (() => {
    switch (callout.kind) {
      case "apply":
        return {
          badge: { status: "registration_open", label: "Applications open" },
          text: closes
            ? `This event takes applications. Apply by ${closes}.`
            : "This event takes applications.",
          action: { label: "Apply", primary: true },
        };
      case "not_open":
        return {
          badge: { status: "opens", date: shortDate(registrationOpensAt) },
          text: "This event takes applications. Come back once they open.",
        };
      case "closed":
        return {
          badge: { status: "registration_closed", label: "Applications closed" },
          text: "Applications for this event have closed.",
        };
      case "draft":
        return {
          badge: { label: "Draft", tone: "neutral", icon: PencilLine },
          text: closes
            ? `Your application is saved as a draft. Submit it by ${closes}.`
            : "Your application is saved as a draft. Submit it when you’re ready.",
          action: { label: "Continue application", primary: true },
        };
      case "draft_closed":
        return {
          badge: { status: "registration_closed", label: "Applications closed" },
          text: "Applications closed before your draft was submitted.",
          action: { label: "View draft" },
        };
      case "pending":
        return {
          badge: { status: "pending" },
          text: "Application submitted. We’ll email you once a decision is made.",
          action: { label: "View application" },
        };
      case "offer_expired":
        return {
          badge: { status: "offer_expired" },
          text: "Your offer to register for this event has expired.",
        };
      case "waitlisted":
        return {
          badge: { status: "waitlisted" },
          text: "You’re on the waitlist. If a spot opens, we’ll let you know.",
        };
      case "not_selected":
        return {
          badge: { status: "not_selected" },
          text: "You weren’t selected this time. Keep an eye out for future events.",
        };
    }
  })();

  return (
    <section
      aria-label="Your application"
      className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-section px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <StatusBadge {...content.badge} />
        <p className="text-small text-foreground">{content.text}</p>
      </div>
      {content.action ? (
        <Button
          asChild
          size="sm"
          variant={content.action.primary ? "primary" : "secondary"}
          className="self-start sm:self-auto max-sm:w-full"
        >
          <Link href={applyHref}>{content.action.label}</Link>
        </Button>
      ) : null}
    </section>
  );
}
