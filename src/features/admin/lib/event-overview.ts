/**
 * The short overview's length limit, shared by the builder, the draft parser,
 * the save action and (as `length()`) the database's publication guard.
 *
 * Characters are counted as code points, the way Postgres `length()` counts
 * them, so an emoji is one character. `String.length` counts UTF-16 units and
 * would count it as two, which is also what a native `maxLength` enforces.
 */
export const SHORT_OVERVIEW_MAX_LENGTH = 120;

export function characterCount(text: string): number {
  return [...text].length;
}

/** `text` cut to `max` characters, never splitting a surrogate pair. */
export function clampCharacters(text: string, max: number): string {
  const characters = [...text];
  return characters.length <= max ? text : characters.slice(0, max).join("");
}

export function shortOverviewTooLong(text: string | null | undefined): boolean {
  return characterCount(text ?? "") > SHORT_OVERVIEW_MAX_LENGTH;
}
