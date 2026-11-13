// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { EventDateLocation } from "./EventDateLocation";
import { emptyLocation, type EventDateLocationDraft } from "../../lib/event-date-location";

afterEach(cleanup);
const settings = (): EventDateLocationDraft => ({ automatic: true, audience: "everyone", location: { ...emptyLocation(), building: "Default venue", address: "Default address" }, dates: [{ key: "one", session_id: null, date: "2099-11-14", start: "09:00", end: "17:00", label: "Opening", location: null }, { key: "two", session_id: null, date: "2099-11-15", start: "10:00", end: "17:00", label: "Workshop", location: null }] });
function Form({ initial = settings() }: { initial?: EventDateLocationDraft }) {
  const [value, setValue] = useState(initial);
  return <><EventDateLocation value={value} onChange={setValue} disabled={false} showErrors={false} /><output aria-label="Saved values">{JSON.stringify(value)}</output></>;
}
const value = () => JSON.parse(screen.getByLabelText("Saved values").textContent!);

describe("event date/location form", () => {
  it("enables the location date selector only after two calendar dates are filled in", () => {
    const initial = settings(); initial.dates = [initial.dates[0]];
    render(<Form initial={initial} />);
    const selector = () => screen.getByRole("combobox", { name: "Date for a different location" }) as HTMLButtonElement;
    expect(selector().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "+ Add date" }));
    expect(selector().disabled).toBe(true);
    const secondDate = screen.getAllByLabelText("Date")[1];
    fireEvent.change(secondDate, { target: { value: "11/15/2099" } });
    fireEvent.blur(secondDate);
    expect(selector().disabled).toBe(false);
    fireEvent.change(secondDate, { target: { value: "" } });
    fireEvent.blur(secondDate);
    expect(selector().disabled).toBe(true);
  });

  it("retains inactive type values and shows the approved public-summary guidance", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("radio", { name: "Online" }));
    fireEvent.change(screen.getByLabelText("Meeting link"), { target: { value: "https://example.com/meeting" } });
    fireEvent.click(screen.getByRole("radio", { name: "In person" }));
    expect((screen.getByLabelText("Building") as HTMLInputElement).value).toBe("Default venue");
    fireEvent.click(screen.getByRole("radio", { name: "Hybrid" }));
    expect((screen.getByLabelText("Meeting link") as HTMLInputElement).value).toBe("https://example.com/meeting");
    fireEvent.click(screen.getByRole("radio", { name: /Confirmed attendees only/ }));
    expect(screen.getByLabelText("Public location summary")).toBeTruthy();
    expect(screen.getByText(/Keep exact private details out/)).toBeTruthy();
  });
  it("keeps a whole-location exception when the default changes, and confirms reset", () => {
    const initial = settings(); initial.dates[1].location = { ...emptyLocation(), type: "online", meeting_url: "https://example.com/workshop" };
    render(<Form initial={initial} />);
    fireEvent.change(screen.getByLabelText("Building"), { target: { value: "New default" } });
    expect(value().dates[0].location).toBeNull();
    expect(value().dates[1].location.meeting_url).toBe("https://example.com/workshop");
    fireEvent.click(screen.getByRole("button", { name: "Use default location" }));
    expect(value().dates[1].location).not.toBeNull();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Use default location" }));
    expect(value().dates[1].location).toBeNull();
  });
  it("removes an exception with a removable date and blocks removal of a started saved date", () => {
    const initial = settings(); initial.dates[0] = { ...initial.dates[0], session_id: "started", date: "2020-01-01" }; initial.dates[1].location = emptyLocation();
    render(<Form initial={initial} />);
    expect((screen.getByRole("button", { name: "Remove date 1" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove date 2" }));
    expect(value().dates).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Use default location" })).toBeNull();
  });
});
