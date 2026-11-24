/** Where we point people for event announcements while the portal's event pages are gated. */
export const LINKTREE_URL = "https://linktr.ee/ubcuxhub";

export const FACULTIES = [
  "Faculty of Arts",
  "Faculty of Applied Science",
  "Faculty of Science",
  "Sauder School of Business",
  "Faculty of Medicine",
  "Faculty of Education",
  "Faculty of Land and Food Systems",
  "Faculty of Forestry",
  "Faculty of Pharmaceutical Sciences",
  "Faculty of Dentistry",
  "Other",
] as const;

export const YEAR_LEVELS = ["1", "2", "3", "4", "5+"] as const;

/** How each year level reads in a profile summary: "3rd year". */
export const YEAR_LABELS: Record<(typeof YEAR_LEVELS)[number], string> = {
  "1": "1st year",
  "2": "2nd year",
  "3": "3rd year",
  "4": "4th year",
  "5+": "5th year or later",
};

/** Whether `value` is one of `YEAR_LEVELS`. */
export function isYearLevel(value: unknown): value is (typeof YEAR_LEVELS)[number] {
  return (YEAR_LEVELS as readonly unknown[]).includes(value);
}

export const STUDENT_STATUSES = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "other", label: "Other" },
] as const;
