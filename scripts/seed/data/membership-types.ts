/**
 * Membership tiers.
 *
 * `eligible_user_types` is the single source of truth for who may buy a tier:
 * `isEligibleForMembership` in src/features/memberships/lib/policy.ts gates
 * both the portal UI and the payment server action on it. A row seeded without
 * it lands on the `'{}'` column default and the tier becomes unpurchasable for
 * everyone. It mirrors the backfill in
 * supabase/migrations/20260727031000_add_membership_eligibility.sql.
 *
 * The `name` values mirror production exactly. Slugs follow the mapping baked
 * into
 * supabase/migrations/20260529110000_add_slugs_for_events_and_memberships.sql.
 */

import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";

export const membershipTypes: TablesInsert<"membership_types">[] = [
  {
    active: true,
    name: "explorer",
    slug: "explorer",
    eligible_user_types: ["ubcStudent"],
    price: 12.0,
    description:
      "Free or discounted entry to every UX Hub event, except UXathon.",
  },
  {
    active: true,
    name: "innovator",
    slug: "innovator",
    eligible_user_types: ["ubcStudent"],
    price: 18.0,
    description:
      "A guaranteed spot at UXathon, plus free or discounted entry to every other UX Hub event.",
  },
  {
    active: true,
    name: "faculty",
    slug: "faculty",
    eligible_user_types: ["faculty"],
    price: 18.0,
    description:
      "Free or discounted entry to every UX Hub event, except UXathon.",
  },
  {
    active: true,
    name: "nonUbc",
    slug: "non-ubc",
    eligible_user_types: ["nonUbc"],
    price: 24.0,
    description:
      "Free or discounted entry to every UX Hub event, except UXathon.",
  },
];
