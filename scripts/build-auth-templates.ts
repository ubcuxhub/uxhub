/**
 * Writes the Supabase auth email templates to supabase/templates.
 *
 *   pnpm email:templates
 *
 * The generated files are committed: the Supabase CLI reads them from disk at
 * `supabase start`, and the hosted project needs them pasted into its dashboard
 * template editor. `src/lib/email/auth-templates.test.ts` fails if the committed
 * files fall behind the source, so a missed run is caught by `pnpm test`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTH_EMAIL_TEMPLATES,
  GENERATED_BANNER,
} from "../src/lib/email/auth-templates.ts";

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "templates"
);

mkdirSync(outDir, { recursive: true });

for (const [filename, render] of Object.entries(AUTH_EMAIL_TEMPLATES)) {
  writeFileSync(join(outDir, filename), `${GENERATED_BANNER}\n${render()}\n`);
  console.log(`wrote supabase/templates/${filename}`);
}
