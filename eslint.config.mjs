import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fill names used as text, status names whose meaning changed, and the
// nonexistent error-foreground pair. This catches classes that Tailwind would
// otherwise accept with the wrong colour or silently fail to generate.
const staleColourClass = String.raw`/(?<![\w-])(?:text-(?:success|warning|error|info|muted|accent|secondary|section|disabled)|(?:border|ring|outline|divide)-(?:success|warning|error|info)|(?:text|bg|border|ring|outline)-error-foreground)(?![\w-])|(?<![\w-])bg-(?:success|warning|error|info)\x2F/`;
const staleColourMessage =
  "Colour class with the wrong meaning: status text is text-<tone>-foreground, error text is text-destructive, and a status tint is bg-<tone> with no opacity. See docs/design-system.md §2.11.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Server code logs through `log` from `@/lib/log`, which is the one module
  // allowed to touch the console. Client components (.tsx) are exempt.
  {
    files: ["src/**/*.ts"],
    rules: { "no-console": "error" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${staleColourClass}]`,
          message: staleColourMessage,
        },
        {
          selector: `TemplateElement[value.raw=${staleColourClass}]`,
          message: staleColourMessage,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
