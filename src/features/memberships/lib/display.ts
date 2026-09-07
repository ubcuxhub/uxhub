/**
 * Membership tier names are stored the way production wrote them — lowercase,
 * and camelCase for the multi-word ones (`explorer`, `nonUbc`). This turns one
 * into something presentable without renaming the rows.
 */

const ACRONYMS = new Set(["ubc", "ux"]);

export function formatMembershipTypeName(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}
