import assert from "node:assert/strict"
import test from "node:test"

import { cn } from "./utils.ts"

const typeScaleClasses = [
  "text-h1",
  "text-h2",
  "text-h3",
  "text-subheading",
  "text-body",
  "text-small",
  "text-label",
  "text-table",
  "text-button",
  "text-badge",
]

test("custom font sizes do not conflict with text colors", () => {
  for (const fontSize of typeScaleClasses) {
    assert.equal(
      cn(fontSize, "text-muted-foreground"),
      `${fontSize} text-muted-foreground`
    )
    assert.equal(
      cn("text-muted-foreground", fontSize),
      `text-muted-foreground ${fontSize}`
    )
  }
})

test("custom font sizes still override other font sizes", () => {
  assert.equal(cn("text-h3", "text-h2", "text-success"), "text-h2 text-success")
  assert.equal(cn("text-h3", "text-sm", "text-success"), "text-sm text-success")
  assert.equal(cn("text-sm", "text-h3", "text-success"), "text-h3 text-success")
})
