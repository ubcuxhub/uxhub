#!/usr/bin/env node

// Usage: node scripts/codemods/colour-classes.mjs [--dry-run|--check]
//   [--include-moved] [files...]
// With no files, migrates tracked source files. The default safe subset is
// idempotent; --include-moved is only for a branch that has never run the
// colour rename because those keys now have different meanings.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import process from "node:process";

const mappings = {
  surface: "background",
  "surface-card": "card",
  "surface-modal": "popover",
  "surface-subtle": "muted",
  "surface-hover": "accent",
  "surface-secondary": "section",
  fg: "foreground",
  "fg-secondary": "muted-foreground",
  "fg-muted": "muted-foreground",
  "fg-disabled": "disabled-foreground",
  "fg-inverse": "primary-foreground",
  action: "primary",
  "action-hover": "primary-hover",
  "action-strong": "primary-active",
  "action-disabled": "disabled-foreground",
  "action-disabled-bg": "disabled",
  "action-disabled-border": "disabled-border",
  "action-destructive": "destructive",
  "action-destructive-hover": "destructive-hover",
  "action-destructive-strong": "destructive-active",
  focus: "ring",
  success: "success-foreground",
  "success-bg": "success",
  "success-active": "success-solid",
  warning: "warning-foreground",
  "warning-bg": "warning",
  error: "destructive",
  "error-bg": "error",
  info: "info-foreground",
  "info-bg": "info",
  accent: "section",
  "background-surface-hover": "accent",
  "background-secondary": "section",
  "text-disabled": "disabled-foreground",
  "text-inverse": "primary-foreground",
  "action-primary-hover": "primary-hover",
  "action-primary-strong": "primary-active",
  "action-disabled-background": "disabled",
  "status-success-text": "success-foreground",
  "status-warning-text": "warning-foreground",
  "status-error-text": "destructive",
  "status-info-text": "info-foreground",
  "status-success-background": "success",
  "status-warning-background": "warning",
  "status-error-background": "error",
  "status-info-background": "info",
  "status-success-active": "success-solid",
  "overlay-scrim": "scrim",
};

// These keys now mean something different. The rename PR applies them once;
// later branch migrations must opt in explicitly so reruns cannot convert the
// new vocabulary a second time.
const movedKeys = new Set(["success", "warning", "error", "info", "accent"]);
const supportedExtensions = new Set([".css", ".js", ".jsx", ".md", ".mdx", ".ts", ".tsx"]);
const prefix = String.raw`(?:bg|text|border|border-[trblxyse]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|decoration|caret|accent|shadow|inset-ring|inset-shadow)`;

const args = process.argv.slice(2);
const includeMoved = args.includes("--include-moved");
const check = args.includes("--check");
const dryRun = args.includes("--dry-run") || check;
const requestedPaths = args.filter((arg) => !arg.startsWith("--"));
const root = process.cwd();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const keys = Object.keys(mappings)
  .filter((key) => includeMoved || !movedKeys.has(key))
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");
const colourClass = new RegExp(
  String.raw`(?<![\w$-])(${prefix})-(${keys})(?=\/[\w.\[\]%]+|(?![\w-]))`,
  "g"
);

const files = requestedPaths.length
  ? requestedPaths.map((file) => relative(root, resolve(root, file)))
  : execFileSync("git", ["ls-files", "-z", "src"], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean);

let filesChanged = 0;
let replacements = 0;

for (const file of files) {
  if (!supportedExtensions.has(extname(file))) continue;

  const original = readFileSync(file, "utf8");
  const replaceClasses = (text) =>
    text.replace(colourClass, (_match, classPrefix, oldKey) => {
      replacements += 1;
      return `${classPrefix}-${mappings[oldKey]}`;
    });
  const updated =
    file === "src/app/globals.css"
      ? original
          .split("\n")
          .map((line) => (line.includes("@apply") ? replaceClasses(line) : line))
          .join("\n")
      : replaceClasses(original);

  if (updated === original) continue;
  filesChanged += 1;
  if (!dryRun) writeFileSync(file, updated);
}

const mode = dryRun ? "would change" : "changed";
console.log(`${mode} ${filesChanged} files with ${replacements} replacements`);
if (check && filesChanged > 0) process.exitCode = 1;
