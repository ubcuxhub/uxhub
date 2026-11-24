// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ScanTicketsCard } from "./ScanTicketsCard";

afterEach(cleanup);

it("names its region and keeps the actions in order", () => {
  render(<ScanTicketsCard description="Opening · Nov 15 · 11:00 AM – 12:00 PM PT">
    <button>Scan tickets</button>
    <button>Open scanner on phone</button>
  </ScanTicketsCard>);
  const region = screen.getByRole("region", { name: "Scan tickets" });
  expect(region.textContent).toContain("Opening · Nov 15 · 11:00 AM – 12:00 PM PT");
  expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["Scan tickets", "Open scanner on phone"]);
  expect(screen.getByRole("heading", { level: 3, name: "Scan tickets" })).toBeTruthy();
});
