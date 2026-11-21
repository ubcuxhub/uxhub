// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EventPeopleEditor, EventResourcesEditor } from "./EventPeopleResources";
import { emptyContent } from "../../lib/event-content";
vi.mock("@/features/admin/actions", () => ({ searchEventDirectoryAction: vi.fn(async () => ({ people: [] })) }));
vi.mock("@/components/shared/Hubbo", () => ({ Hubbo: () => <span aria-hidden /> }));
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
HTMLElement.prototype.scrollIntoView = vi.fn();
afterEach(cleanup);
function Editor() {
  const [content, setContent] = useState(emptyContent());
  return <><EventPeopleEditor content={content} onChange={setContent} showErrors /><EventResourcesEditor content={content} onChange={setContent} showErrors /><output data-testid="document">{JSON.stringify(content)}</output></>;
}
it("uses one fixed group, retains content when collapsed, and reorders collapsed sections", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Judges" }));
  expect((screen.getByRole("button", { name: "Judges" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByLabelText("Section name")).toBeNull();
  expect(screen.getByText("Add at least one item or remove this section.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add new person" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alex Chen" } });
  fireEvent.click(screen.getByRole("button", { name: "Sponsors" }));
  fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  fireEvent.keyDown(screen.getByRole("button", { name: "Drag Sponsors to reorder" }), { key: "ArrowUp" });
  const saved = JSON.parse(screen.getByTestId("document").textContent!);
  expect(saved.sections.map((section: { title: string }) => section.title)).toEqual(["Sponsors", "Judges"]);
  expect(saved.sections[1].items[0].name).toBe("Alex Chen");
});
it("offers custom names and audience defaults without a shared-directory save", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Custom section" }));
  fireEvent.change(screen.getByLabelText("Section name"), { target: { value: "Alumni" } });
  fireEvent.click(screen.getByRole("button", { name: "Participant package" }));
  const saved = JSON.parse(screen.getByTestId("document").textContent!);
  expect(saved.sections[0]).toMatchObject({ kind: "custom", title: "Alumni" });
  expect(saved.links[0]).toMatchObject({ label: "Participant package", visibility: "going" });
});
it("scrolls and focuses each newly created section, including custom sections", () => {
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  render(<Editor />);
  for (const name of ["Judges", "Sponsors", "Custom section"]) {
    fireEvent.click(screen.getByRole("button", { name }));
    const saved = JSON.parse(screen.getByTestId("document").textContent!);
    expect(document.activeElement?.id).toBe(`people-section-${saved.sections.at(-1).key}`);
  }
  expect(scroll).toHaveBeenCalledTimes(3);
  expect(scroll).toHaveBeenLastCalledWith({ block: "start", behavior: "instant" });
});
it("keeps resource edits and removal while exposing no resource reorder controls", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Slack workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Participant package" }));
  expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Drag / })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
  expect(JSON.parse(screen.getByTestId("document").textContent!).links.map((link: { type: string }) => link.type)).toEqual(["participant_package"]);
});
it("inserts sections before or after a whole-card target in both directions", () => {
  render(<Editor />);
  for (const name of ["Judges", "Mentors", "Sponsors"]) fireEvent.click(screen.getByRole("button", { name }));
  const sections = () => JSON.parse(screen.getByTestId("document").textContent!).sections as { key: string; title: string }[];
  const drop = (source: string, target: string, y: number) => {
    const card = document.getElementById(`people-section-${sections().find(section => section.title === target)!.key}`)!;
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top: 100, height: 400 } as DOMRect);
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(event, { clientY: { value: y }, dataTransfer: { value: { types: ["application/x-event-section"], getData: () => sections().find(section => section.title === source)!.key } } });
    fireEvent(card, event);
  };
  drop("Judges", "Sponsors", 450);
  expect(sections().map(section => section.title)).toEqual(["Mentors", "Sponsors", "Judges"]);
  drop("Judges", "Mentors", 150);
  expect(sections().map(section => section.title)).toEqual(["Judges", "Mentors", "Sponsors"]);
});

it("reorders people entries through their handles without movement buttons", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Judges" }));
  for (const name of ["Alex", "Sam"]) {
    fireEvent.click(screen.getByRole("button", { name: "Add new person" }));
    fireEvent.change(screen.getAllByLabelText("Full name").at(-1)!, { target: { value: name } });
  }
  expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  const handle = screen.getByRole("button", { name: "Drag Sam to reorder" });
  handle.focus();
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  expect(JSON.parse(screen.getByTestId("document").textContent!).sections[0].items.map((item: { name: string }) => item.name)).toEqual(["Sam", "Alex"]);
  expect(document.activeElement).toBe(handle);
});

it("adds Volunteer Schedule as a normal link row with fixed staff access, HTTPS validation and singleton controls", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Volunteer Schedule" }));
  const audience = screen.getByRole("combobox", { name: "Who can see it" }) as HTMLButtonElement;
  expect(audience.disabled).toBe(true);
  expect(audience.textContent).toContain("Only staff");
  expect((screen.getByRole("button", { name: "Volunteer Schedule" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Link"), { target: { value: "http://example.test/shifts" } });
  expect(screen.getByText("Use an absolute HTTPS URL without a username or password.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Link"), { target: { value: "https://example.test/shifts" } });
  expect(screen.queryByText("Use an absolute HTTPS URL without a username or password.")).toBeNull();
  fireEvent.change(screen.getByLabelText("Button label (optional)"), { target: { value: "Staff shifts" } });
  fireEvent.click(screen.getByRole("button", { name: "Slack workspace" }));
  const saved = JSON.parse(screen.getByTestId("document").textContent!);
  expect(saved.links[0]).toMatchObject({ type: "volunteer_schedule", visibility: "staff", label: "Staff shifts", url: "https://example.test/shifts" });
  fireEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
  expect(JSON.parse(screen.getByTestId("document").textContent!).links.map((link: { type: string }) => link.type)).toEqual(["slack_workspace"]);
  expect((screen.getByRole("button", { name: "Volunteer Schedule" }) as HTMLButtonElement).disabled).toBe(false);
});

it("offers Volunteer Schedule in the existing type selector and restores ordinary audience controls when switched back", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Other link" }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Type" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: "Volunteer Schedule" }));
  expect((screen.getByRole("combobox", { name: "Who can see it" }) as HTMLButtonElement).disabled).toBe(true);
  expect(JSON.parse(screen.getByTestId("document").textContent!).links[0].visibility).toBe("staff");
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Type" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: "Participant package" }));
  expect((screen.getByRole("combobox", { name: "Who can see it" }) as HTMLButtonElement).disabled).toBe(false);
  expect(JSON.parse(screen.getByTestId("document").textContent!).links[0].visibility).toBe("going");
});
