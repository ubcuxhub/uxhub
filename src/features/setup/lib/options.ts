/**
 * The fixed choices member setup offers, shared by setup, Settings and the
 * admin user record.
 *
 * Ids are what the database stores; labels are display copy and may change.
 * The step, diet, allergy and avatar ids are also listed in CHECK constraints
 * (supabase/migrations/20261110030244_add_member_setup.sql and
 * 20261110041028_add_setup_user_type.sql), so adding or renaming one needs a
 * migration too. User type ids are the `user_type` enum's values. Interests are validated here only, since
 * `user_info.interests` also holds managers' free tags.
 *
 * Dependency-free on purpose: the seed (scripts/seed) imports it directly.
 */

export const SETUP_STEPS = ["about", "dietary", "photo", "interests"] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];
/** `user_info.setup_step`: the step to show next, or `done`. */
export type SetupStep = SetupStepId | "done";

/**
 * "What best describes you?": the `user_type` enum, in the words membership
 * join uses. The same answer decides which memberships a member can buy.
 */
export const USER_TYPE_OPTIONS = [
  {
    id: "ubcStudent",
    title: "I’m a UBC student",
    description: "Currently enrolled at The University of British Columbia.",
  },
  {
    id: "faculty",
    title: "I’m a UBC faculty member",
    description: "Faculty or staff at The University of British Columbia.",
  },
  {
    id: "nonUbc",
    title: "I’m not from UBC",
    description: "Joining from outside The University of British Columbia.",
  },
] as const;
export type UserTypeId = (typeof USER_TYPE_OPTIONS)[number]["id"];

export const DIET_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
] as const;
export type DietId = (typeof DIET_OPTIONS)[number]["id"];

export const ALLERGY_OPTIONS = [
  { id: "peanuts", label: "Peanuts" },
  { id: "tree-nuts", label: "Tree nuts" },
  { id: "dairy", label: "Dairy" },
  { id: "eggs", label: "Eggs" },
  { id: "gluten", label: "Gluten" },
  { id: "soy", label: "Soy" },
  { id: "fish", label: "Fish" },
  { id: "shellfish", label: "Shellfish" },
] as const;
export type AllergyId = (typeof ALLERGY_OPTIONS)[number]["id"];

/** Free "other allergies" entries: limits the database also enforces. */
export const OTHER_ALLERGIES_MAX = 20;
export const OTHER_ALLERGY_MAX_LENGTH = 200;

/**
 * Figma 4297:2 marks this list as a placeholder. 19 options, under the
 * 20-tag cap on `user_info.interests`.
 */
export const INTEREST_GROUPS = [
  {
    id: "design",
    label: "Design",
    options: [
      { id: "ux-research", label: "UX research" },
      { id: "ui-design", label: "UI design" },
      { id: "interaction-design", label: "Interaction design" },
      { id: "design-systems", label: "Design systems" },
      { id: "accessibility", label: "Accessibility" },
      { id: "prototyping", label: "Prototyping" },
      { id: "motion-design", label: "Motion design" },
      { id: "content-design", label: "Content design" },
    ],
  },
  {
    id: "events",
    label: "Events",
    options: [
      { id: "workshops", label: "Workshops" },
      { id: "speaker-panels", label: "Speaker panels" },
      { id: "portfolio-reviews", label: "Portfolio reviews" },
      { id: "uxathon", label: "UXathon" },
      { id: "networking", label: "Networking" },
      { id: "socials", label: "Socials" },
      { id: "industry-tours", label: "Industry tours" },
    ],
  },
  {
    id: "career",
    label: "Career",
    options: [
      { id: "internships-and-co-op", label: "Internships and co-op" },
      { id: "mentorship", label: "Mentorship" },
      { id: "job-search", label: "Job search" },
      { id: "freelancing", label: "Freelancing" },
    ],
  },
] as const;
export type InterestGroupId = (typeof INTEREST_GROUPS)[number]["id"];
export type InterestId =
  (typeof INTEREST_GROUPS)[number]["options"][number]["id"];
export const INTEREST_OPTIONS = INTEREST_GROUPS.flatMap((group) =>
  group.options.map((option) => ({ ...option, group: group.id }))
);

/**
 * Brand shapes from the auth brand panel, not Hubbo (the mascot appears once
 * per screen). The app draws them; the database stores only the key.
 */
export const AVATAR_PRESETS = [
  { id: "pointer", label: "Pink pointer" },
  { id: "splash", label: "Purple splash" },
  { id: "flower", label: "Purple flower" },
  { id: "triangle", label: "Purple triangle" },
  { id: "sparkle", label: "Pink sparkle" },
  { id: "starburst", label: "Pink starburst" },
] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number]["id"];

/** The label for a stored interest, or the value itself for a manager's free tag. */
export function interestLabel(value: string): string {
  return INTEREST_OPTIONS.find((option) => option.id === value)?.label ?? value;
}
