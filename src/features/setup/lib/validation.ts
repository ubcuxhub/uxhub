import {
  ALLERGY_OPTIONS,
  AVATAR_PRESETS,
  DIET_OPTIONS,
  INTEREST_OPTIONS,
  OTHER_ALLERGIES_MAX,
  OTHER_ALLERGY_MAX_LENGTH,
  SETUP_STEPS,
  USER_TYPE_OPTIONS,
  type AllergyId,
  type AvatarPreset,
  type DietId,
  type InterestId,
  type SetupStep,
  type SetupStepId,
  type UserTypeId,
} from "./options";

/**
 * Validation for everything the setup actions accept. Server actions take
 * input from the network, so each parser checks the shape as well as the
 * values, and throws an `Error` whose message is fit to show the member.
 */

export interface DietaryNeeds {
  diets: DietId[];
  allergies: AllergyId[];
  otherAllergies: string[];
}

const DIET_IDS = new Set<string>(DIET_OPTIONS.map((option) => option.id));
const ALLERGY_IDS = new Set<string>(ALLERGY_OPTIONS.map((option) => option.id));
const INTEREST_IDS = new Set<string>(INTEREST_OPTIONS.map((option) => option.id));
const AVATAR_IDS = new Set<string>(AVATAR_PRESETS.map((option) => option.id));
const USER_TYPE_IDS = new Set<string>(USER_TYPE_OPTIONS.map((option) => option.id));

export function isSetupStepId(value: unknown): value is SetupStepId {
  return typeof value === "string" && (SETUP_STEPS as readonly string[]).includes(value);
}

export function isSetupStep(value: unknown): value is SetupStep {
  return value === "done" || isSetupStepId(value);
}

function stringList(value: unknown, message: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(message);
  }
  return value as string[];
}

/** Ids from `allowed`, deduplicated, in the order given. */
function optionList<T extends string>(value: unknown, allowed: Set<string>, message: string): T[] {
  const list = stringList(value, message);
  if (list.some((item) => !allowed.has(item))) throw new Error(message);
  return [...new Set(list)] as T[];
}

/** Trimmed, blank entries dropped, duplicates (ignoring case) dropped. */
export function normalizeOtherAllergies(value: unknown): string[] {
  const list = stringList(value, "Other allergies must be text.");
  const entries: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const entry = raw.trim();
    if (!entry) continue;
    if (entry.length > OTHER_ALLERGY_MAX_LENGTH) {
      throw new Error(`Keep each allergy under ${OTHER_ALLERGY_MAX_LENGTH} characters.`);
    }
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  if (entries.length > OTHER_ALLERGIES_MAX) {
    throw new Error(`Add at most ${OTHER_ALLERGIES_MAX} other allergies.`);
  }
  return entries;
}

/** All three empty is a valid answer: "I don't have any dietary needs". */
export function parseDietaryNeeds(value: unknown): DietaryNeeds {
  if (!value || typeof value !== "object") throw new Error("Choose your dietary needs.");
  const input = value as Record<string, unknown>;
  return {
    diets: optionList<DietId>(input.diets ?? [], DIET_IDS, "Choose diets from the list."),
    allergies: optionList<AllergyId>(
      input.allergies ?? [],
      ALLERGY_IDS,
      "Choose allergies from the list."
    ),
    otherAllergies: normalizeOtherAllergies(input.otherAllergies ?? []),
  };
}

export function parseInterests(value: unknown): InterestId[] {
  return optionList<InterestId>(value, INTEREST_IDS, "Choose interests from the list.");
}

export function parseAvatarPreset(value: unknown): AvatarPreset {
  if (typeof value !== "string" || !AVATAR_IDS.has(value)) {
    throw new Error("Choose an icon from the list.");
  }
  return value as AvatarPreset;
}

export function parseUserType(value: unknown): UserTypeId {
  if (typeof value !== "string" || !USER_TYPE_IDS.has(value)) {
    throw new Error("Choose what best describes you from the list.");
  }
  return value as UserTypeId;
}
