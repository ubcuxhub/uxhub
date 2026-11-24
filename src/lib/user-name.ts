/**
 * A member's names. The last name is optional, for people with one name: it's
 * stored as the empty string, never null. Join them with `formatUserName`,
 * which drops an empty part.
 */
export interface UserName {
  first_name: string;
  last_name: string;
}

export function formatUserName(user: UserName): string {
  return [user.first_name.trim(), user.last_name.trim()]
    .filter(Boolean)
    .join(" ");
}

export function splitUserName(fullName: string): UserName | null {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  const separator = normalized.indexOf(" ");

  if (separator < 1 || separator === normalized.length - 1) {
    return null;
  }

  return {
    first_name: normalized.slice(0, separator),
    last_name: normalized.slice(separator + 1),
  };
}

function metadataString(
  metadata: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

/**
 * The names auth metadata does supply, each possibly empty: password sign-up
 * writes `first_name`/`last_name`, OAuth providers `given_name`/`family_name`
 * or a single `full_name`/`name`. A one-word full name gives a first name
 * only, a complete name for someone with one. Without a first name, the
 * add-your-name form asks for it, prefilled with whatever is here.
 */
export function getPartialUserNameFromMetadata(
  metadata: Record<string, unknown>
): UserName {
  const firstName = metadataString(metadata, ["first_name", "given_name"]);
  const lastName = metadataString(metadata, ["last_name", "family_name"]);

  if (firstName && lastName) {
    return { first_name: firstName, last_name: lastName };
  }

  const fullName = metadataString(metadata, ["full_name", "name"]);
  const splitName = splitUserName(fullName);
  const firstWord = fullName.split(/\s+/, 1)[0] ?? "";

  return {
    first_name: firstName || splitName?.first_name || firstWord,
    last_name: lastName || splitName?.last_name || "",
  };
}
