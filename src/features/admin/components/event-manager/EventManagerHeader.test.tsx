// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/supabase/models";
import { EventManagerHeader } from "./EventManagerHeader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const base = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "UXathon 2027",
  status: "active",
  publish_at: null,
  canceled_at: null,
  slug: "uxathon-2027",
  starts_at: "2027-01-16T17:00:00.000Z",
  ends_at: "2027-01-17T01:00:00.000Z",
  location_building: "Nest",
  location_room: "2500",
} as EventRow;

function renderHeader(event: EventRow) {
  return render(<EventManagerHeader event={event} tabs={[]} publicPages pathname="/x" />);
}

afterEach(cleanup);

describe("EventManagerHeader thumbnail", () => {
  it("shows the event's image at the manager's size", () => {
    const { container } = renderHeader({ ...base, image_url: "/poster.png" });
    const thumb = container.querySelector('[data-slot="record-thumbnail"]');
    expect(thumb?.querySelector("img")?.getAttribute("src")).toBe("/poster.png");
    expect(thumb?.className).toContain("size-16");
    expect(thumb?.className).toContain("sm:size-20");
  });

  it("shows the placeholder without an image", () => {
    const { container } = renderHeader({ ...base, image_url: null });
    const thumb = container.querySelector('[data-slot="record-thumbnail"]');
    expect(thumb).not.toBeNull();
    expect(thumb?.querySelector("img")).toBeNull();
    expect(thumb?.querySelector("svg")).not.toBeNull();
  });
});
