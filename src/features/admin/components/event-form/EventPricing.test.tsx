// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EventPricing } from "./EventPricing";
import { EventMarketing, EventFeatured } from "./EventMarketing";
import { defaultFormState, type EventFormState } from "./event-form-schema";

beforeAll(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(cleanup);

function Form({ legacy = false, locked = false, showErrors = false }: { legacy?: boolean; locked?: boolean; showErrors?: boolean }) {
  const [state, setState] = useState<EventFormState>({ ...defaultFormState, page_slug: "design-sprint", pricing_mode: legacy ? "legacy" : "free", regular_price: "10", member_price: "5" });
  const change = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => setState(current => ({ ...current, [field]: value }));
  return <><EventMarketing showErrors={showErrors} state={state} urlLocked={locked} onChange={change} /><EventFeatured state={state} onChange={change} /><EventPricing showErrors={showErrors} state={state} locked={locked} effectivePrices={legacy ? { regular: 10, member: 5 } : undefined} onChange={change} /></>;
}

describe("event configuration controls", () => {
  it("selects Free/Paid cards and retains the amount when switching", () => {
    render(<Form />);
    expect(screen.getByRole("radio", { name: /^Free/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /^Paid/ }));
    fireEvent.change(screen.getByLabelText("Non-member price (CAD)"), { target: { value: "12.50" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Free/ }));
    expect(screen.queryByLabelText("Non-member price (CAD)")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /^Paid/ }));
    expect(screen.getByLabelText("Non-member price (CAD)")).toHaveProperty("value", "12.50");
  });
  it("links invalid configuration errors to the relevant fields after validation", () => {
    render(<Form showErrors />);
    fireEvent.click(screen.getByRole("radio", { name: /^Paid/ }));
    const amount = screen.getByLabelText("Non-member price (CAD)");
    fireEvent.change(amount, { target: { value: "1.001" } });
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(amount.getAttribute("aria-describedby")!.split(" ").at(-1)!)?.textContent).toContain("two decimal places");
    fireEvent.click(screen.getByRole("radio", { name: /^Another website/ }));
    expect(screen.getByLabelText("Website URL").getAttribute("aria-invalid")).toBe("true");
  });
  it("requires explicit configuration to leave legacy pricing", () => {
    render(<Form legacy />);
    expect(screen.queryByRole("radio", { name: /^Paid/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Configure Free/Paid pricing" }));
    expect(screen.getByRole("radio", { name: /^Paid/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("Non-member price (CAD)")).toHaveProperty("value", "10");
  });
  it("shows a locked summary and read-only hosted URL", () => {
    render(<Form legacy locked />);
    expect(screen.getByRole("note", { name: "Pricing is locked" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Configure Free/ })).toBeNull();
    expect(screen.getByLabelText("Page URL")).toHaveProperty("readOnly", true);
  });
  it("switches destinations, preserves external input, and saves a featured choice without claiming Home delivery", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("radio", { name: /^Another website/ }));
    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "https://devpost.com/design" } });
    fireEvent.click(screen.getByRole("switch", { name: "Marketing page" }));
    expect(screen.queryByLabelText("Website URL")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Marketing page" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Another website/ }));
    expect(screen.getByLabelText("Website URL")).toHaveProperty("value", "https://devpost.com/design");
    fireEvent.click(screen.getByRole("switch", { name: "Feature on the portal home" }));
    expect(screen.getByRole("switch", { name: "Feature on the portal home" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/does not add the event to Home yet/)).not.toBeNull();
  });
});
