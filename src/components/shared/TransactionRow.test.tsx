// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DetailList, DetailRow } from "./DetailRow";
import { TransactionRow, formatSignedAmount } from "./TransactionRow";

afterEach(cleanup);

describe("record rows", () => {
  it("keeps label/value semantics and reads an absent value as None", () => {
    const { container } = render(<DetailList><DetailRow label="Phone" /><DetailRow label="Email">jane@example.com</DetailRow></DetailList>);
    expect(container.querySelector("dl")).toBeTruthy();
    expect(screen.getByText("Phone").tagName).toBe("DT");
    expect(screen.getByText("None").parentElement?.tagName).toBe("DD");
    expect(screen.getByText("jane@example.com").tagName).toBe("DD");
  });

  it("formats signed Canadian amounts and spells out the transaction direction", () => {
    expect(formatSignedAmount(-1500)).toEqual({ text: "−$15.00", tone: "negative", spoken: "Charge $15.00 CAD" });
    expect(formatSignedAmount(10000)).toEqual({ text: "+$100.00", tone: "positive", spoken: "Credit $100.00 CAD" });
  });

  it("shows text cues alongside the amount and keeps dates visible", () => {
    render(<TransactionRow title="Membership" amountCents={-1500} date="Sept 27, 2026" />);
    expect(screen.getByText("−$15.00")).toBeTruthy();
    expect(screen.getByText("Charge")).toBeTruthy();
    expect(screen.getByText("Sept 27, 2026")).toBeTruthy();
  });
});
