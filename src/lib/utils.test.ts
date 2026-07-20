import { describe, expect, it } from "vitest";
import { cn } from "./utils";

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
];

describe("cn", () => {
  it.each(typeScaleClasses)(
    "keeps %s alongside a text color",
    (fontSize) => {
      expect(cn(fontSize, "text-muted-foreground")).toBe(
        `${fontSize} text-muted-foreground`
      );
      expect(cn("text-muted-foreground", fontSize)).toBe(
        `text-muted-foreground ${fontSize}`
      );
    }
  );

  it("lets a custom font size override another custom font size", () => {
    expect(cn("text-h3", "text-h2", "text-success")).toBe(
      "text-h2 text-success"
    );
  });

  it("lets a built-in font size override a custom one", () => {
    expect(cn("text-h3", "text-sm", "text-success")).toBe(
      "text-sm text-success"
    );
  });

  it("lets a custom font size override a built-in one", () => {
    expect(cn("text-sm", "text-h3", "text-success")).toBe(
      "text-h3 text-success"
    );
  });
});
