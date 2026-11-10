import { INTEREST_OPTIONS, type InterestId } from "@/features/setup/lib/options";

/** `user_info.interests` holds at most this many tags (`valid_user_interests`). */
export const INTERESTS_MAX = 20;

const TAXONOMY = new Set<string>(INTEREST_OPTIONS.map((option) => option.id));

/**
 * The interests to store when a member edits theirs in Settings: their
 * chosen taxonomy ids, plus every free tag a manager added (which members
 * can't see as chips, so mustn't lose by saving). A tag that matches a chosen
 * id ignoring case is dropped, since the column is unique ignoring case.
 */
export function mergeMemberInterests(existing: readonly string[], chosen: readonly InterestId[]): string[] {
  const picked = [...new Set(chosen)];
  const taken = new Set(picked.map((id) => id.toLowerCase()));
  const managerTags = existing.filter((tag) => {
    if (TAXONOMY.has(tag) || taken.has(tag.toLowerCase())) return false;
    taken.add(tag.toLowerCase());
    return true;
  });
  const merged = [...managerTags, ...picked];
  if (merged.length > INTERESTS_MAX) {
    throw new Error(`Choose at most ${INTERESTS_MAX - managerTags.length} interests.`);
  }
  return merged;
}
