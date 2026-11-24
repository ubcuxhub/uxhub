import type { EventState } from "./event-states";

/**
 * The button on the public event page. `checkout` opens the registration
 * flow, `link` goes to a portal page, and `disabled` only says why there's
 * nothing to do.
 */
export type PublicEventAction =
  | { kind: "checkout"; label: string; href: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "disabled"; label: string };

/**
 * The public event page's button for a viewer's state (`eventStateFor`), so
 * it agrees with the portal's registration panel. A signed-out visitor's
 * state has no ticket or application; a signed-in student who has one is
 * sent to the portal event page, which shows their ticket or decision.
 */
export function publicEventActionFor(state: EventState, slug: string): PublicEventAction {
  const portalPage = `/portal/events/${slug}`;
  switch (state.kind) {
    case "reg-open":
      return { kind: "checkout", label: "Register Now", href: `${portalPage}/checkout` };
    case "app-open":
      return { kind: "link", label: "Apply", href: `${portalPage}/apply` };
    case "app-draft":
      return { kind: "link", label: "Continue Application", href: `${portalPage}/apply` };
    case "reg-going":
    case "reg-checked-in":
      return { kind: "link", label: "View Your Ticket", href: portalPage };
    case "app-accepted":
      return { kind: "link", label: "Confirm Your Spot", href: portalPage };
    case "app-in-review":
    case "app-waitlisted":
    case "app-rejected":
    case "app-draft-expired":
    case "app-offer-expired":
      return { kind: "link", label: "View Your Application", href: portalPage };
    case "canceled":
      return { kind: "disabled", label: "Event Canceled" };
    case "reg-past":
    case "reg-past-attended":
      return { kind: "disabled", label: "Event Ended" };
    case "reg-upcoming":
      return { kind: "disabled", label: "Registration Opens Soon" };
    case "app-upcoming":
      return { kind: "disabled", label: "Applications Open Soon" };
    case "reg-full":
      return { kind: "disabled", label: "Event Full" };
    case "reg-closed":
      return { kind: "disabled", label: "Registration Closed" };
    case "app-missed":
      return { kind: "disabled", label: "Applications Closed" };
    default:
      return assertNever(state);
  }
}

function assertNever(state: never): never {
  throw new Error(`Unhandled event state: ${JSON.stringify(state)}`);
}
