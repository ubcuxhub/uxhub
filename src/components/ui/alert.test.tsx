// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

afterEach(cleanup);

describe("Alert status presentations", () => {
  it("presents a neutral locked setting as a non-interrupting note with its text and icon", () => {
    render(<Alert variant="neutral" icon={<Lock aria-hidden />} aria-label="Locked pricing"><AlertTitle>Prices are locked</AlertTitle><AlertDescription>People have registered.</AlertDescription></Alert>);
    const note = screen.getByRole("note", { name: "Locked pricing" });
    expect(note.className).toContain("bg-muted");
    expect(note.className).toContain("text-foreground");
    expect(note.textContent).toContain("Prices are locked");
    expect(note.textContent).toContain("People have registered.");
    expect(note.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("retains the existing default warning and other status tokens", () => {
    const { rerender } = render(<Alert>Membership ends soon.</Alert>);
    expect(screen.getByRole("note").className).toContain("bg-warning");
    for (const [variant, token] of [["info", "bg-info"], ["destructive", "bg-error"]] as const) {
      rerender(<Alert variant={variant}>Status message.</Alert>);
      expect(screen.getByRole("note").className).toContain(token);
    }
  });
});
