// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CalendarDays } from "lucide-react";
import { EventBanner } from "./EventBanner";
import { EventPreview, EventPreviewSkeleton } from "./EventPreview";
import { QuickLink } from "./QuickLink";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

it("falls back after failed artwork and tries a changed URL", () => {
  const { container, rerender } = render(<EventBanner src="/first.png" />);
  expect(container.querySelector("img")?.alt).toBe("");
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).toBeTruthy();
  rerender(<EventBanner src="/second.png" colour="#325DC4" />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/second.png");
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("svg")).toBeNull();
  expect((container.firstChild as HTMLElement).style.backgroundColor).toBe("rgb(50, 93, 196)");
});

it("keeps full long copy, labelled facts, title navigation and loading announcements", () => {
  const title = "An event title that wraps over many lines in a narrow preview";
  const description = "Full description. ".repeat(40);
  const { rerender } = render(<EventPreview title={title} href="/overview" description={description}
    banner={{}} status={<span>Open</span>} facts={[{ label: "Date", icon: CalendarDays, value: "November 7–21, 2026" }]}
    actions={<Button>Check-in</Button>} />);
  expect(screen.getByRole("link", { name: title }).getAttribute("href")).toBe("/overview");
  expect(screen.getByText(description.trim())).toBeTruthy();
  expect(screen.getByRole("term").textContent).toBe("Date");
  expect(screen.getByRole("definition").textContent).toBe("November 7–21, 2026");
  rerender(<EventPreviewSkeleton />);
  expect(screen.getByRole("status", { name: "Loading upcoming event" })).toBeTruthy();
});

it("keeps missing quick links inert and explains availability to keyboard users", async () => {
  render(<QuickLink title="Drive" description="Files" icon={<CalendarDays />} href={null} unavailable="Google Drive link coming soon" />);
  expect((screen.getByRole("button", { name: "Drive" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("link")).toBeNull();
  const trigger = screen.getByLabelText("Drive: Google Drive link coming soon");
  fireEvent.keyDown(document, { key: "Tab" });
  fireEvent.focus(trigger);
  expect(await screen.findByRole("tooltip")).toBeTruthy();
  fireEvent.keyDown(trigger, { key: "Escape" });
});
