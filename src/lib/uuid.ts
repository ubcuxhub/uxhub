const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether `value` is shaped like a UUID.
 *
 * Postgres rejects anything else compared against a `uuid` column with
 * "invalid input syntax for type uuid", which surfaces as a thrown error.
 * Check a URL segment with this before it reaches such a query.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
