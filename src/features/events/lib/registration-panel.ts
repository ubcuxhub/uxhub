import { CircleMinus, Hourglass, Lock, type LucideIcon } from "lucide-react";

import { formatEventDate } from "@/lib/date";

import type { EventState } from "./event-states";

/**
 * What the registration panel on the portal event page shows for each event
 * state (docs/event-states.md): the card's title and subheading, which of the
 * three layouts it uses, and that layout's copy and actions. Pure, so every
 * state's copy is tested without rendering; `RegistrationPanel` draws it.
 */

/** A button the panel shows, and where it goes. */
export type PanelAction = { label: string } & (
  /** The checkout dialog, opened over the page. */
  | { kind: "flow"; href: string }
  /** An in-app page. */
  | { kind: "link"; href: string }
  /** Somewhere outside the app, in a new tab. */
  | { kind: "external"; href: string }
  /** The "Your ticket" dialog. */
  | { kind: "view-ticket" }
);

export interface AlertLayoutProps {
  variant: "neutral" | "warning" | "destructive";
  icon?: LucideIcon;
  title: string;
  description: string;
  /** An optional text link under the alert. */
  link?: PanelAction;
}

export interface ActionLayoutProps {
  title: string;
  description?: string;
  action: PanelAction;
}

export interface TicketLayoutProps {
  /** Left out when the copy has no title: the description stands alone. */
  title?: string;
  description: string;
  /** What the price will be, before they've paid: "CA$15.00 for non-members". */
  priceLine?: string;
  /** `locked` until they register; `used` once checked in. */
  ticketState: "active" | "used" | "locked";
  primary?: PanelAction;
  secondary?: PanelAction;
}

export type LayoutSpec =
  | { layout: "alert"; props: AlertLayoutProps }
  | { layout: "action"; props: ActionLayoutProps }
  | { layout: "ticket"; props: TicketLayoutProps };

export type PanelSpec = LayoutSpec & {
  /** "Application" while the student is applying; "Registration" otherwise. */
  title: "Registration" | "Application";
  subheading?: string;
};

/** Everything the copy needs beyond the state itself. */
export interface PanelContext {
  eventName: string;
  eventSlug: string;
  /** When the event ends: `ends_at`, or `starts_at` without one. */
  endsAt: string | null;
  /** What this student would pay, from the checkout's own rule. */
  price: { amount: number; isMember: boolean };
  /** The event's participant package link, if it has one the student may see. */
  participantPackageUrl: string | null;
  /** How far a draft application has got, for `app-draft`. */
  draftProgress: { answered: number; total: number } | null;
}

/** "Wed, Aug 26, 2026", in Pacific time. */
const longDate = (value: string | null) =>
  formatEventDate(value, { weekday: "short", month: "short" });

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

const KEEP_AN_EYE_OUT =
  "Keep an eye out for upcoming events. We’d love to see you at the next one.";

/** The price line before registering; nothing when it's free. */
function priceLine({ amount, isMember }: PanelContext["price"]): string | undefined {
  if (amount <= 0) return undefined;
  return `CA${currency.format(amount)} for ${isMember ? "members" : "non-members"}`;
}

export function getPanelSpec(state: EventState, context: PanelContext): PanelSpec {
  const { eventName, eventSlug } = context;
  const checkout: PanelAction = {
    kind: "flow",
    label: "Register",
    href: `/portal/events/${eventSlug}/checkout`,
  };
  const apply = (label: string): PanelAction => ({
    kind: "link",
    label,
    href: `/portal/events/${eventSlug}/apply`,
  });
  const ticketActions = {
    primary: { kind: "view-ticket", label: "View ticket" } as PanelAction,
    secondary: context.participantPackageUrl
      ? ({
          kind: "external",
          label: "View participant package",
          href: context.participantPackageUrl,
        } as PanelAction)
      : undefined,
  };

  switch (state.kind) {
    case "reg-upcoming":
      return {
        title: "Registration",
        layout: "alert",
        props: {
          variant: "neutral",
          title: "Registrations haven’t opened yet",
          description: `Registrations open on ${longDate(state.opensAt)}.`,
        },
      };
    case "reg-open":
      return {
        title: "Registration",
        layout: "action",
        props: {
          title: "Registration is open",
          description: state.closesAt ? `Closes ${longDate(state.closesAt)}` : undefined,
          action: checkout,
        },
      };
    case "reg-going":
      return {
        title: "Registration",
        subheading: "1 ticket",
        layout: "ticket",
        props: {
          title: `You’re going to ${eventName}`,
          description: "Show your ticket at check-in.",
          ticketState: "active",
          ...ticketActions,
        },
      };
    case "reg-checked-in":
      return {
        title: "Registration",
        subheading: "1 ticket",
        layout: "ticket",
        props: {
          description: "You’re checked in",
          ticketState: "used",
          ...ticketActions,
        },
      };
    case "reg-full":
      return {
        title: "Registration",
        layout: "alert",
        props: {
          variant: "destructive",
          icon: Lock,
          title: "This event is full",
          description: KEEP_AN_EYE_OUT,
        },
      };
    case "reg-closed":
      return {
        title: "Registration",
        layout: "alert",
        props: {
          variant: "neutral",
          title: "Registration is closed",
          description: `Registration closed on ${longDate(state.closedAt)}. ${KEEP_AN_EYE_OUT}`,
        },
      };
    case "reg-past":
      return {
        title: "Registration",
        layout: "alert",
        props: {
          variant: "neutral",
          title: "Registration is closed",
          description: context.endsAt
            ? `This event ended on ${longDate(context.endsAt)}.`
            : "This event has ended.",
        },
      };
    case "reg-past-attended":
      return {
        title: "Registration",
        subheading: "1 ticket",
        layout: "ticket",
        props: {
          title: `Thanks for coming to ${eventName}`,
          description: "The event has ended",
          ticketState: "active",
        },
      };
    case "app-upcoming":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "neutral",
          title: "Applications haven’t opened yet",
          description: `Applications open on ${longDate(state.opensAt)}.`,
        },
      };
    case "app-open":
      return {
        title: "Application",
        layout: "action",
        props: {
          // TODO(copy): the copy doc's title here is the payment-failure line
          // ("This event is full. You haven't been charged."); confirm this one.
          title: "Applications are open",
          description: state.closesAt ? `Apply by ${longDate(state.closesAt)}.` : undefined,
          action: apply("Apply"),
        },
      };
    case "app-draft": {
      const progress = context.draftProgress;
      return {
        title: "Application",
        subheading:
          progress && progress.total > 0
            ? `${progress.answered} of ${progress.total} questions answered`
            : undefined,
        layout: "action",
        props: {
          title: "Finish your application",
          description: state.closesAt
            ? `Your answers are saved. Submit by ${longDate(state.closesAt)}.`
            : "Your answers are saved.",
          action: apply("Continue application"),
        },
      };
    }
    case "app-in-review":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "warning",
          icon: Hourglass,
          title: "Your application is in review",
          description: "We’ll email you once a decision is made.",
        },
      };
    case "app-waitlisted":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "warning",
          icon: Hourglass,
          title: "You’re on the waitlist",
          description:
            "You’ll be notified here on the portal and by email if you’re offered a spot. You don’t need to do anything until then.",
        },
      };
    case "app-accepted":
      // An accepted student registers next, so the card is Registration again.
      return {
        title: "Registration",
        layout: "ticket",
        props: {
          title: `You’re accepted to ${eventName}`,
          description: "If you don’t confirm in time, you may lose your spot.",
          priceLine: priceLine(context.price),
          ticketState: "locked",
          primary: { ...checkout, label: "Confirm" },
        },
      };
    case "app-rejected":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "neutral",
          icon: CircleMinus,
          title: "You weren’t selected for this event",
          description: "Thanks for applying. Keep an eye out for upcoming events.",
        },
      };
    case "app-missed":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "neutral",
          icon: Lock,
          title: "Applications are closed",
          description: `Applications closed on ${longDate(state.closedAt)}. ${KEEP_AN_EYE_OUT}`,
        },
      };
    case "app-draft-expired":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "neutral",
          icon: Lock,
          title: "Your application wasn’t submitted",
          description: `Applications closed on ${longDate(state.closedAt)} before your draft was submitted. ${KEEP_AN_EYE_OUT}`,
        },
      };
    case "app-offer-expired":
      return {
        title: "Application",
        layout: "alert",
        props: {
          variant: "neutral",
          icon: Lock,
          title: "Your spot is no longer held",
          description: `You were accepted, but your spot wasn’t confirmed by ${longDate(state.offerExpiredAt)}. ${KEEP_AN_EYE_OUT}`,
        },
      };
    default:
      return assertNever(state);
  }
}

function assertNever(state: never): never {
  throw new Error(`Unhandled event state: ${JSON.stringify(state)}`);
}
