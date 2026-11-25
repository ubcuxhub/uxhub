import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), flags: { studentEvents: true } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/flags", () => ({ FLAGS: mocks.flags }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => "public-client" }));
vi.mock("@/features/marketing/homepage-sections/Navbar", () => ({ default: () => null }));
vi.mock("@/features/marketing/homepage-sections/Footer", () => ({ default: () => null }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEvents: mocks.list }));

import EventsPage from "./page";
import { MarketingEventCard } from "@/features/marketing/components/MarketingEventCard";

const event = (id: string, over: Record<string, unknown> = {}) => ({
  id, slug: id, name: id, starts_at: "2099-01-01T18:00:00Z", ends_at: "2099-01-01T20:00:00Z",
  configured_marketing_mode: null, configured_marketing_url: null, marketing_url: null, ...over,
});

function cards(node: unknown): ReactElement<{ event: { id: string }; href: string; external: boolean }>[] {
  if (Array.isArray(node)) return node.flatMap(cards);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: unknown }>;
  const own = element.type === MarketingEventCard ? [element as never] : [];
  return [...own, ...cards(element.props.children)];
}

beforeEach(() => { vi.clearAllMocks(); mocks.flags.studentEvents = true; });

it("leaves out events with the marketing page off and links external ones out", async () => {
  mocks.list.mockResolvedValue([
    event("hosted", { configured_marketing_mode: "hosted" }),
    event("off", { configured_marketing_mode: "disabled" }),
    event("ext", { configured_marketing_mode: "external", configured_marketing_url: "https://example.com/e" }),
    event("legacy"),
  ]);
  const found = cards(await EventsPage()).map((c) => ({ id: c.props.event.id, href: c.props.href, external: c.props.external }));
  expect(found).toEqual([
    { id: "hosted", href: "/events/hosted", external: false },
    { id: "ext", href: "https://example.com/e", external: true },
    { id: "legacy", href: "/events/legacy", external: false },
  ]);
});

it("shows the empty state when every event is off", async () => {
  mocks.list.mockResolvedValue([event("off", { configured_marketing_mode: "disabled" })]);
  expect(cards(await EventsPage())).toEqual([]);
});

it("lists upcoming events soonest first, then past ones most recent first", async () => {
  mocks.list.mockResolvedValue([
    event("oldest", { starts_at: "2020-01-01T18:00:00Z", ends_at: "2020-01-01T20:00:00Z" }),
    event("recent", { starts_at: "2021-01-01T18:00:00Z", ends_at: null }),
    event("soon", { starts_at: "2099-01-01T18:00:00Z" }),
    event("later", { starts_at: "2099-06-01T18:00:00Z" }),
  ]);
  const tree = await EventsPage();
  expect(cards(tree).map((c) => c.props.event.id)).toEqual(["soon", "later", "recent", "oldest"]);
  expect(JSON.stringify(tree)).toContain("Past Events");
});

it("says events are coming soon when only past events exist", async () => {
  mocks.list.mockResolvedValue([event("old", { starts_at: "2020-01-01T18:00:00Z", ends_at: null })]);
  const tree = await EventsPage();
  expect(JSON.stringify(tree)).toContain("Events coming soon");
  expect(cards(tree).map((c) => c.props.event.id)).toEqual(["old"]);
});

it("still redirects while the feature is gated", async () => {
  mocks.flags.studentEvents = false;
  await expect(EventsPage()).rejects.toThrow("redirect:/#events");
});
