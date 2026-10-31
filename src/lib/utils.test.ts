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
    "text-text-disabled",
    "text-text-inverse",
    "text-status-success-text",
    "text-status-error-text",
  ])("treats %s as a colour, not a font size", (colour) => {
    expect(cn("text-small", colour)).toBe(`text-small ${colour}`);
    expect(cn(colour, "text-small")).toBe(`${colour} text-small`);
    expect(cn("text-muted-foreground", colour)).toBe(colour);
  });

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

  it("lets a later size replace an earlier one among the added sizes", () => {
    expect(cn("text-button", "text-button-small", "text-success")).toBe(
      "text-button-small text-success"
    );
    expect(cn("text-body", "text-body-medium")).toBe("text-body-medium");
  });

  it("treats shadow-overlay as an elevation, not a shadow colour", () => {
    expect(cn("shadow-md", "shadow-overlay")).toBe("shadow-overlay");
    expect(cn("shadow-overlay", "shadow-sm")).toBe("shadow-sm");
    expect(cn("shadow-overlay", "shadow-fg-inverse")).toBe(
      "shadow-overlay shadow-fg-inverse"
    );
  });
});
