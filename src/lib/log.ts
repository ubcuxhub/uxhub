import "server-only";

/**
 * Structured server-side logging.
 *
 * Production emits one JSON line per event so the hosting platform can index
 * and filter it; development emits the same data in a readable form.
 *
 * Fields are deliberately restricted to primitives. Passing an `Error` or a
 * database response object is a type error, which forces every call site to
 * decide what is safe to record. Use `errorFields` to include an error, and
 * identify records by id — never by email, name, or student number.
 */

type Fields = Record<string, string | number | boolean | null>;

type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, fields?: Fields) {
  const line = { level, event, time: new Date().toISOString(), ...fields };

  // This module is the single console boundary for server code.
  // eslint-disable-next-line no-console
  const sink = level === "error" ? console.error : console.log;

  sink(
    process.env.NODE_ENV === "production"
      ? JSON.stringify(line)
      : `${level} ${event} ${fields ? JSON.stringify(fields) : ""}`.trimEnd()
  );
}

export const log = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};

/**
 * Describes an error without recording its message. A database or upstream
 * error message can quote row data, and it is never useful member-facing copy.
 */
export function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { errorType: error.name };
  }

  if (error && typeof error === "object") {
    const code = (error as Record<string, unknown>).code;

    return {
      errorType: "SupabaseError",
      ...(typeof code === "string" ? { code } : {}),
    };
  }

  return { errorType: typeof error };
}
