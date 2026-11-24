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
 * only, which is what the add-your-name form prefills.
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

export function getUserNameFromMetadata(
  metadata: Record<string, unknown>
): UserName | null {
  const name = getPartialUserNameFromMetadata(metadata);

  return name.first_name && name.last_name ? name : null;
}
