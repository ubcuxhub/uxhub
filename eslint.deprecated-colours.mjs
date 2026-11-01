// Rejects the deprecated colour utilities that `src/app/globals.css` keeps as
// compatibility aliases until the week of November 16. The key list is read
// from that file's "DEPRECATED aliases" block, so it cannot drift from the
// aliases themselves; replacements come from the §2.11 table in
// docs/design-system.md, indexed by the CSS variable each alias points to.
//
// This is a plugin rule (not another `no-restricted-syntax` entry) so each
// report can name the replacement class.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;
const globalsCss = readFileSync(join(root, "src/app/globals.css"), "utf8");
const designSystem = readFileSync(join(root, "docs/design-system.md"), "utf8");

// alias key (`fg-secondary`) -> CSS variable it points to (`--text-secondary`)
function readDeprecatedAliases() {
  const start = globalsCss.indexOf("DEPRECATED aliases");
  const end = globalsCss.indexOf("\n}", start);
  const aliases = new Map();
  if (start === -1 || end === -1) return aliases;
  const entry = /^\s*--color-([\w-]+):\s*var\((--[\w-]+)\);/gm;
  for (const [, key, target] of globalsCss.slice(start, end).matchAll(entry)) {
    aliases.set(key, target);
  }
  return aliases;
}

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

const aliases = readDeprecatedAliases();
const replacements = readReplacements();

// A silent no-op is worse than a loud failure if either file is reshaped.
if (aliases.size === 0) {
  throw new Error(
    'eslint.deprecated-colours: no aliases found under "DEPRECATED aliases" in src/app/globals.css',
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
  return `\`${prefix}-${key}\` is deprecated; ${hint}.`;
}

const rule = {
  meta: {
    type: "suggestion",
    schema: [],
    docs: { description: "Reject deprecated colour utility aliases." },
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
export const deprecatedColourKeyCount = aliases.size;
