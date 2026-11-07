/**
 * How an application answer is stored in `event_application_responses.response`,
 * which is one text column for every question type.
 *
 * - Text, choice and dropdown answers are the text itself.
 * - Checkbox answers are a JSON array of the chosen option labels, such as
 *   `["Research","Design, UI"]`, so an option may contain a comma. Answers
 *   saved before drafts were comma-joined (`Research, Design`); decoding reads
 *   both.
 * - File answers are the object key in the `application-files` bucket
 *   (`applicationFilePath` in `src/lib/supabase-helpers/application-files.ts`).
 *
 * `submit_event_application` applies the same idea of an empty answer as
 * `hasApplicationAnswer`: blank text, or `[]` for checkboxes.
 *
 * No imports, so `scripts/seed` can load this file directly.
 */

/** Stores a checkbox selection. */
export function encodeCheckboxResponse(values: readonly string[]): string {
  return JSON.stringify(values);
}

/**
 * Reads a checkbox answer in either form. With `options`, a legacy
 * comma-joined answer is split on the option labels, so one containing a
 * comma survives; without them it is split on every comma.
 */
export function decodeCheckboxResponse(
  response: string | null | undefined,
  options?: readonly string[] | null
): string[] {
  const text = response?.trim() ?? "";
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (
        Array.isArray(parsed) &&
        parsed.every((value) => typeof value === "string")
      ) {
        return parsed;
      }
    } catch {
      // Not JSON after all: a legacy answer whose first option starts with "[".
    }
  }

  return splitLegacyCheckboxResponse(text, options ?? []);
}

/**
 * Splits `Research, Design, UI` into its options, preferring the longest
 * option label at each position so `Design, UI` stays whole when it is one.
 */
function splitLegacyCheckboxResponse(
  text: string,
  options: readonly string[]
): string[] {
  const byLength = [...options].sort((a, b) => b.length - a.length);
  const values: string[] = [];
  let rest = text;

  while (rest) {
    const option = byLength.find(
      (candidate) =>
        candidate &&
        rest.startsWith(candidate) &&
        (rest.length === candidate.length ||
          rest.slice(candidate.length).trimStart().startsWith(","))
    );
    const comma = rest.indexOf(",");
    const value = option ?? (comma === -1 ? rest : rest.slice(0, comma));
    if (value.trim()) values.push(value.trim());

    const next = rest.slice(value.length).trimStart();
    rest = next.startsWith(",") ? next.slice(1).trimStart() : next;
  }

  return values;
}

/** Whether an answer counts as given, the way submit_event_application sees it. */
export function hasApplicationAnswer(
  responseType: string,
  response: string | null | undefined
): boolean {
  if (!response?.trim()) return false;
  if (responseType === "checkbox") {
    return decodeCheckboxResponse(response).length > 0;
  }
  return true;
}

/** The file name a member uploaded, from the object key a file answer holds. */
export function applicationFileName(response: string | null | undefined): string {
  if (!response) return "";
  return response.slice(response.lastIndexOf("/") + 1);
}
