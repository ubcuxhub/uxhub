import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AUTH_EMAIL_TEMPLATES, GENERATED_BANNER } from "./auth-templates.ts";

const templateDir = join(process.cwd(), "supabase", "templates");

describe("auth email templates", () => {
  it.each(Object.keys(AUTH_EMAIL_TEMPLATES))(
    "supabase/templates/%s matches the generated output",
    (filename) => {
      const render =
        AUTH_EMAIL_TEMPLATES[filename as keyof typeof AUTH_EMAIL_TEMPLATES];
      const onDisk = readFileSync(join(templateDir, filename), "utf-8");

      // Fails when the source changed but `pnpm email:templates` was not run.
      expect(onDisk).toBe(`${GENERATED_BANNER}\n${render()}\n`);
    }
  );

  it("links through ConfirmationURL so sign-up reaches /auth/callback", () => {
    for (const render of Object.values(AUTH_EMAIL_TEMPLATES)) {
      const html = render();

      expect(html).toContain("{{ .ConfirmationURL }}");
      // A token-hash link would bypass the callback that creates user_info.
      expect(html).not.toContain("{{ .TokenHash }}");
    }
  });
});
