/**
 * Teams the local seed makes, through the same create_team and join_team
 * functions the app calls, so a fixture's team is one the rules allow.
 *
 * A team needs ticket holders on a team event before its deadline. The
 * purchasable events stay free of fixture tickets, so the seeded teams live on
 * the mentorship program, where the deep fixtures hold tickets. Its third
 * ticket holder, student-innovator@example.com, is left without a team, so
 * both card states are there to sign in to.
 *
 * Written only for the local target, with the user fixtures: prod never gets
 * accounts, so it never gets teams.
 */
export interface SeedTeam {
  eventSlug: string;
  name: string | null;
  ownerEmail: string;
  memberEmails: string[];
}

export const seedTeams: SeedTeam[] = [
  {
    eventSlug: "mentorship-program",
    name: "Pixel Pushers",
    ownerEmail: "admin-explorer@example.com",
    memberEmails: ["no-membership@example.com"],
  },
];
