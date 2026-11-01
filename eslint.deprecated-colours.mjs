// Rejects the colour utilities retired in the design-system rename (`fg-*`,
// `action*`, `surface-*`, `*-bg`, `status-*`, `text-text-*`, `background-*`,
// `overlay-scrim`). Their aliases are gone from `src/app/globals.css`, so a
// class using one would generate no CSS and fail silently; this rule makes it
// fail loudly instead. Replacements come from the §2.11 table in
// docs/design-system.md, indexed by the CSS variable each old name pointed to.
//
// This is a plugin rule (not another `no-restricted-syntax` entry) so each
// report can name the replacement class.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;
const designSystem = readFileSync(join(root, "docs/design-system.md"), "utf8");

// retired key (`fg-secondary`) -> CSS variable it pointed to (`--text-secondary`)
const aliases = new Map([
  ["surface", "--background-surface-default"],
  ["surface-card", "--background-surface-card"],
  ["surface-modal", "--background-surface-modal"],
  ["surface-subtle", "--background-surface-subtle"],
  ["surface-hover", "--background-surface-hover"],
  ["surface-secondary", "--background-secondary"],
  ["fg", "--text-primary"],
  ["fg-secondary", "--text-secondary"],
  ["fg-muted", "--text-muted"],
  ["fg-disabled", "--text-disabled"],
  ["fg-inverse", "--text-inverse"],
  ["action", "--action-primary"],
  ["action-hover", "--action-primary-hover"],
  ["action-strong", "--action-primary-strong"],
  ["action-disabled-bg", "--action-disabled-background"],
  ["action-disabled-border", "--action-disabled-border"],
  ["action-destructive", "--action-destructive"],
  ["action-destructive-hover", "--action-destructive-hover"],
  ["action-destructive-strong", "--action-destructive-strong"],
  ["focus", "--action-focus"],
  ["success-bg", "--status-success-background"],
  ["success-active", "--status-success-active"],
  ["warning-bg", "--status-warning-background"],
  ["error-bg", "--status-error-background"],
  ["info-bg", "--status-info-background"],
  ["background-secondary", "--background-secondary"],
  ["background-surface-hover", "--background-surface-hover"],
  ["text-disabled", "--text-disabled"],
  ["text-inverse", "--text-inverse"],
  ["action-primary-hover", "--action-primary-hover"],
  ["action-primary-strong", "--action-primary-strong"],
  ["action-disabled-background", "--action-disabled-background"],
  ["status-success-text", "--status-success-text"],
  ["status-warning-text", "--status-warning-text"],
  ["status-error-text", "--status-error-text"],
  ["status-info-text", "--status-info-text"],
  ["status-success-background", "--status-success-background"],
  ["status-warning-background", "--status-warning-background"],
  ["status-error-background", "--status-error-background"],
  ["status-info-background", "--status-info-background"],
  ["status-success-active", "--status-success-active"],
  ["overlay-scrim", "--overlay-scrim"],
]);

// CSS variable (`--text-secondary`) -> classes from its §2.11 row
function readReplacements() {
  const replacements = new Map();
  const row = /^\|[^|]*\|\s*`(--[\w-]+)`\s*\|([^|]*)\|/gm;
  for (const [, variable, classes] of designSystem.matchAll(row)) {
    const names = [...classes.matchAll(/`([^`]+)`/g)].map(([, name]) =>
      name.replace(/^(?:[\w-]+:)+/, ""),
    );
    replacements.set(variable, names);
  }
  return replacements;
}

const replacements = readReplacements();

// A silent no-op is worse than a loud failure if the doc table is reshaped.
if (replacements.size === 0) {
  throw new Error(
    "eslint.deprecated-colours: no §2.11 rows found in docs/design-system.md",
  );
}

const byLength = (a, b) => b.length - a.length;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Every Tailwind colour utility prefix (longest first so `ring-offset` wins).
const prefixes = [
  "bg",
  "text",
  "border(?:-[xytblrse])?",
  "ring-offset",
  "ring",
  "outline",
  "divide",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
  "shadow",
  "decoration",
  "accent",
  "caret",
  "placeholder",
]
  .sort(byLength)
  .join("|");
const keys = [...aliases.keys()].sort(byLength).map(escape).join("|");

// A variant prefix (`hover:`, `dark:`, `md:`) in front and an `/opacity` after
// are not part of the match, so every variant and opacity form is caught.
const deprecatedClass = new RegExp(
  `(?<![\\w-])(${prefixes})-(${keys})(?![\\w-])`,
  "g",
);

function describe(prefix, key) {
  const variable = aliases.get(key);
  const names = replacements.get(variable) ?? [];
  const property = prefix.split("-")[0];
  const suggestion = names.find((name) => name.startsWith(`${property}-`));
  const hint = suggestion
    ? `use \`${suggestion}\``
    : `see the ${variable} row in docs/design-system.md §2.11`;
  return `\`${prefix}-${key}\` was removed; ${hint}.`;
}

const rule = {
  meta: {
    type: "suggestion",
    schema: [],
    docs: { description: "Reject retired colour utility names." },
  },
  create(context) {
    function check(node, text) {
      for (const [, prefix, key] of text.matchAll(deprecatedClass)) {
        context.report({ node, message: describe(prefix, key) });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};

export const deprecatedColours = {
  rules: { "no-deprecated-colour-class": rule },
};
