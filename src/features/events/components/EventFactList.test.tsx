// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Calendar, Tag } from "lucide-react";
import { EventFactList, formatPrice, priceFact, registrationFact } from "./EventFactList";

afterEach(cleanup);

describe("EventFactList", () => {
  it("names each fact for assistive technology and shows its lines", () => {
    render(<EventFactList facts={[
      { key: "date", icon: Calendar, term: "Date and time", value: "Friday, December 11, 2026", detail: "1:00 PM – 4:00 PM" },
      { key: "price", icon: Tag, term: "Price", value: "Free" },
    ]} />);
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Date and time", "Price"]);
    expect(screen.getByText("1:00 PM – 4:00 PM").tagName).toBe("DD");
    expect(screen.getByText("Free").className).toContain("self-center");
  });

  it("renders nothing without facts", () => {
    const { container } = render(<EventFactList facts={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("priceFact", () => {
  it("formats prices", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(10)).toBe("$10.00");
  });

  it("shows the member price only when it differs", () => {
    expect(priceFact(10, 0)).toEqual({ value: "$10.00", detail: "Free for UX Hub members" });
    expect(priceFact(10, 5)).toEqual({ value: "$10.00", detail: "$5.00 for UX Hub members" });
    expect(priceFact(0, 0)).toEqual({ value: "Free", detail: undefined });
    expect(priceFact(8, null)).toEqual({ value: "$8.00", detail: undefined });
  });

  it("says so when the price isn't set", () => {
    expect(priceFact(null, 0)).toEqual({ value: "Price to be confirmed" });
  });
});

describe("registrationFact", () => {
  const base = {
    opensAt: "2026-10-20T16:00:00Z",
    closesAt: "2026-12-06T20:00:00Z",
    spotsLeft: 3,
    capacity: 25,
    requiresApplication: false,
  };

  it("gives the deadline and the seats left while registration is open", () => {
    expect(registrationFact({ ...base, window: "open" })).toEqual({ value: "Register by Sun, Dec 6", detail: "3 of 25 spots left" });
  });

  it("says when registration opens", () => {
    expect(registrationFact({ ...base, window: "upcoming" })).toEqual({ value: "Registration opens Tue, Oct 20", detail: undefined });
  });

  it("speaks of applications for an application event, without a seat count", () => {
    expect(registrationFact({ ...base, window: "open", requiresApplication: true })).toEqual({ value: "Apply by Sun, Dec 6", detail: "Application required" });
    expect(registrationFact({ ...base, window: "upcoming", requiresApplication: true })?.value).toBe("Applications open Tue, Oct 20");
  });

  it("falls back when there are no dates or no capacity", () => {
    expect(registrationFact({ ...base, window: "open", closesAt: null, capacity: null })).toEqual({ value: "Registration open", detail: undefined });
  });

  it("counts no seats for an event without a capacity", () => {
    expect(registrationFact({ ...base, window: "open", spotsLeft: null, capacity: null })).toEqual({ value: "Register by Sun, Dec 6", detail: undefined });
  });

  it("leaves closed and full to the button", () => {
    expect(registrationFact({ ...base, window: "closed" })).toBeNull();
    expect(registrationFact({ ...base, window: "full" })).toBeNull();
  });
});
