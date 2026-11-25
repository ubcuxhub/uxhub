import {
  hasActiveMembership,
  type MembershipExpiryUser,
} from "@/features/memberships/lib/expiry";
import type { EventRow } from "@/lib/supabase/models";

/** The fields that say when an event ends. */
export type EventTimes = Pick<EventRow, "starts_at" | "ends_at">;

/**
 * When an event ends: its `ends_at`, or its `starts_at` when it has no end
 * (docs/event-states.md, "An event ends"). `null` for an undated event.
 */
export function eventEndsAt(event: EventTimes): string | null {
  return event.ends_at ?? event.starts_at;
}

/**
 * Whether an event has ended. The end instant itself still belongs to the
 * event, as in the database, so it ends only after it. An undated event
 * never has.
 */
export function hasEventEnded(event: EventTimes, now: Date = new Date()): boolean {
  const end = eventEndsAt(event);
  return !!end && now.getTime() > Date.parse(end);
}

/** The fields that decide what a student pays for an event. */
export type PricedEvent = Pick<EventRow, "pricing_policy" | "member_price" | "regular_price">;

export interface EventPrice {
  /** In dollars; `null` until the event's pricing is configured. */
  amount: number | null;
  /** Whether the member price applies. */
  isMember: boolean;
}

/**
 * What a student pays for an event. Under the `figma` pricing policy only an
 * active membership (through the club term, `membershipTermEndsAt`) gets the
 * member price; legacy events give it to anyone with a membership tier. The
 * registration panel and the checkout both read it, so the price the panel
 * quotes is the one the checkout charges.
 */
export function eventPriceFor(
  event: PricedEvent,
  user: MembershipExpiryUser,
  membershipTermEndsAt: string | null,
): EventPrice {
  const isMember = event.pricing_policy === "figma"
    ? hasActiveMembership(user, membershipTermEndsAt)
    : Boolean(user.membership_type_id);
  return { amount: isMember ? event.member_price : event.regular_price, isMember };
}
