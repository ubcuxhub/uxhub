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

export function getUserNameFromMetadata(
  metadata: Record<string, unknown>
): UserName | null {
  const firstName = metadataString(metadata, ["first_name", "given_name"]);
  const lastName = metadataString(metadata, ["last_name", "family_name"]);

  if (firstName && lastName) {
    return { first_name: firstName, last_name: lastName };
  }

  const fullName = metadataString(metadata, ["full_name", "name"]);
  const splitName = splitUserName(fullName);
  const resolvedFirstName = firstName || splitName?.first_name || "";
  const resolvedLastName = lastName || splitName?.last_name || "";

  return resolvedFirstName && resolvedLastName
    ? { first_name: resolvedFirstName, last_name: resolvedLastName }
    : null;
}
