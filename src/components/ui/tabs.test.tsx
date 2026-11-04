// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

afterEach(cleanup);

function Example() {
  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Event sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="registrations" count={128}>
          Registrations
        </TabsTrigger>
        <TabsTrigger value="teams" disabled>
          Teams
        </TabsTrigger>
        <TabsTrigger value="judges">Judges</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="registrations">Registrations panel</TabsContent>
      <TabsContent value="judges">Judges panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("exposes a labelled tablist with the first tab selected", () => {
    render(<Example />);

    expect(screen.getByRole("tablist", { name: "Event sections" }));
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Overview panel");
  });

  it("includes the count in the tab's accessible name", () => {
    render(<Example />);

    const tab = screen.getByRole("tab", { name: "Registrations 128" });
    expect(tab.querySelector("[data-slot=tabs-trigger-count]")?.textContent).toBe("128");
  });

  it("moves with the arrow keys, skipping a disabled tab, and wraps", async () => {
    render(<Example />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();

    fireEvent.keyDown(overview, { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Registrations 128" })),
    );
    // Automatic activation: focus selects.
    expect(screen.getByRole("tabpanel").textContent).toBe("Registrations panel");

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Judges" })),
    );

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(overview));
  });

  it("jumps to the first and last tab with Home and End", async () => {
    render(<Example />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();

    fireEvent.keyDown(overview, { key: "End" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Judges" })),
    );

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    await waitFor(() => expect(document.activeElement).toBe(overview));
  });

  it("makes the panel focusable so Tab reaches it", () => {
    render(<Example />);

    expect(screen.getByRole("tabpanel").getAttribute("tabindex")).toBe("0");
  });

  it("marks the disabled tab", () => {
    render(<Example />);

    const tab = screen.getByRole("tab", { name: "Teams" });
    expect(tab.hasAttribute("disabled")).toBe(true);
  });
});
