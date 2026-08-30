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
    name: "explorer",
    slug: "explorer",
    eligible_user_types: ["ubcStudent"],
    price: 12.0,
    description:
      "Whether you're new to UX or just curious where to start, Explorer gets you through the door. Come to our socials, workshops, and industry talks at member pricing, and meet the community without committing to the full season.",
    features: [
      "Member pricing on all UX Hub events",
      "Access to socials, workshops, and industry talks",
      "Members-only Discord and job-posting channel",
      "Priority waitlist for office tours",
    ],
  },
  {
    name: "innovator",
    slug: "innovator",
    eligible_user_types: ["ubcStudent"],
    price: 18.0,
    description:
      "This tier includes everything in Explorer plus priority access to our two flagship hands-on events, the Design Sprint and UXathon. Built for students who want portfolio work, mentorship, and a real shot at the capacity-limited events.",
    features: [
      "Everything in Explorer",
      "Priority application review for Design Sprint and UXathon",
      "1:1 portfolio review with an industry mentor each term",
      "Reserved spots on industry office tours",
      "Exclusive resume and case-study workshops",
    ],
  },
  {
    name: "faculty",
    slug: "faculty",
    eligible_user_types: ["faculty"],
    price: 18.0,
    description:
      "For UBC faculty and staff who want to stay connected to the student design community. Full access to talks, panels, and showcases, plus an open invitation to mentor at our hands-on events.",
    features: [
      "Member pricing on all UX Hub events",
      "Invitations to student showcases and panels",
      "Mentorship opportunities at Design Sprint and UXathon",
      "Termly newsletter on student design work",
    ],
  },
  {
    name: "nonUbc",
    slug: "non-ubc",
    eligible_user_types: ["nonUbc"],
    price: 24.0,
    description:
      "This tier is for anyone outside UBC — working designers, students at other schools, and career changers. Same access as our student members, with an emphasis on the industry nights and portfolio events.",
    features: [
      "Member pricing on all UX Hub events",
      "Access to industry talks, panels, and socials",
      "Portfolio review nights and networking sessions",
      "Members-only Discord and job-posting channel",
    ],
  },
];
