import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// Colour keys must never reuse these names: tailwind-merge keeps one member of
// its font-size group and one member of its text-colour group.
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
  "text-body-medium",
  "text-table-heading",
  "text-button-small",
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

  it.each([
    "text-disabled-foreground",
    "text-primary-foreground",
    "text-success-foreground",
    "text-destructive",
  ])("treats %s as a colour, not a font size", (colour) => {
    expect(cn("text-small", colour)).toBe(`text-small ${colour}`);
    expect(cn(colour, "text-small")).toBe(`${colour} text-small`);
    expect(cn("text-muted-foreground", colour)).toBe(colour);
  });

  it("lets a custom font size override another custom font size", () => {
    expect(cn("text-h3", "text-h2", "text-success-foreground")).toBe(
      "text-h2 text-success-foreground"
    );
  });

  it("lets a built-in font size override a custom one", () => {
    expect(cn("text-h3", "text-sm", "text-success-foreground")).toBe(
      "text-sm text-success-foreground"
    );
  });

  it("lets a custom font size override a built-in one", () => {
    expect(cn("text-sm", "text-h3", "text-success-foreground")).toBe(
      "text-h3 text-success-foreground"
    );
  });

  it("lets a later size replace an earlier one among the added sizes", () => {
    expect(cn("text-button", "text-button-small", "text-success-foreground")).toBe(
      "text-button-small text-success-foreground"
    );
    expect(cn("text-body", "text-body-medium")).toBe("text-body-medium");
  });

  it("treats shadow-overlay as an elevation, not a shadow colour", () => {
    expect(cn("shadow-md", "shadow-overlay")).toBe("shadow-overlay");
    expect(cn("shadow-overlay", "shadow-sm")).toBe("shadow-sm");
    expect(cn("shadow-overlay", "shadow-primary-foreground")).toBe(
      "shadow-overlay shadow-primary-foreground"
    );
  });

  it("keeps destructive text and fill classes together", () => {
    expect(cn("text-destructive", "bg-destructive")).toBe(
      "text-destructive bg-destructive"
    );
  });

  it("lets a destructive edge replace an input edge", () => {
    expect(cn("border-input", "border-destructive")).toBe(
      "border-destructive"
    );
  });

  it("lets a section fill replace a muted fill", () => {
    expect(cn("bg-muted", "bg-section")).toBe("bg-section");
  });
});
