/**
 * Membership tiers.
 *
 * The `name` values mirror production exactly and are load-bearing: `canPurchase`
 * in src/app/(app)/(focused)/portal/membership/page.tsx gates tiers with
 * `name.toLowerCase().includes("explorer" | "innovator" | "faculty" | "non")`,
 * and src/features/payments/fulfillment.ts repeats the same matching. Rename a
 * tier here and every card renders "Not Available".
 *
 * Slugs follow the mapping baked into
 * supabase/migrations/20260529110000_add_slugs_for_events_and_memberships.sql.
 */

import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";

export const membershipTypes: TablesInsert<"membership_types">[] = [
  {
    name: "explorer",
    slug: "explorer",
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
