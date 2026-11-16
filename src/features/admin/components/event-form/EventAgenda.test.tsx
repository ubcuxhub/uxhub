// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { EventAgenda } from "./EventAgenda";
import { emptyAgendaDay, emptyAgendaItem, emptyLocation, type EventDateLocationDraft } from "../../lib/event-date-location";

afterEach(cleanup);
function Form({ attended = false }: { attended?: boolean }) {
  const [enabled,setEnabled] = useState(true);
  const [value,setValue] = useState<EventDateLocationDraft>(() => {
    const day = { ...emptyAgendaDay(), label: "Workshop", date: "2099-08-01", location: { ...emptyLocation(), building: "Nest", address: "UBC" } };
    day.items = [{ ...emptyAgendaItem(day.date), label: "Design", start: "09:00", end: "12:00", check_in: attended, attended }];
    return { version: 2, automatic: true, audience: "everyone", location: day.location, dates: [day] };
  });
  return <><EventAgenda value={value} onChange={setValue} enabled={enabled} onEnabledChange={setEnabled} disabled={false} showErrors={false} /><output aria-label="Saved values">{JSON.stringify({ value, enabled })}</output></>;
}
const saved = () => JSON.parse(screen.getByLabelText("Saved values").textContent!);

describe("unified agenda editor", () => {
  it("retains items with the display switch off and gives each day its own location", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("switch", { name: "Show agenda on the event page" }));
    expect(saved().enabled).toBe(false);
    expect(saved().value.dates[0].items[0].label).toBe("Design");
    fireEvent.click(screen.getByRole("button", { name: "+ Add day" }));
    expect(screen.getAllByLabelText("Day label")).toHaveLength(2);
    expect(saved().value.dates[1].location.building).toBe("");
    expect(screen.getAllByLabelText("Starts")).toHaveLength(1);
  });
  it("inherits day location and allows a whole-location override without changing the day", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("switch", { name: "Use a different location" }));
    fireEvent.change(screen.getAllByLabelText("Building")[1], { target: { value: "Library" } });
    expect(saved().value.dates[0].location.building).toBe("Nest");
    expect(saved().value.dates[0].items[0].location.building).toBe("Library");
    fireEvent.click(screen.getByRole("switch", { name: "Use a different location" }));
    expect(saved().value.dates[0].items[0].location).toBeNull();
  });
  it("confirms removals and protects attended items and their parent day", () => {
    const first = render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(saved().value.dates[0].items).toHaveLength(1);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove item" }));
    expect(saved().value.dates[0].items).toHaveLength(0);
    first.unmount();
    render(<Form attended />);
    expect((screen.getByRole("switch", { name: "Enable check-in" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Remove item 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Remove day 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Attendance has been recorded/)).toBeTruthy();
  });
});
