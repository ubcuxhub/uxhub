// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/supabase/models";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const BASE = `/admin/events/${EVENT_ID}`;

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  client: vi.fn(),
  event: vi.fn(),
  toReview: vi.fn(),
  pathname: { current: "" },
  notFound: vi.fn(() => {
    throw new Error("Not found");
  }),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventById: mocks.event }));
vi.mock("@/lib/supabase-helpers/event-application-review-counts", () => ({
  fetchSubmittedApplicationCounts: mocks.toReview,
}));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  usePathname: () => mocks.pathname.current,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    transitionTypes,
    ...props
  }: { href: string; children: React.ReactNode; transitionTypes?: string[] } & React.ComponentProps<"a">) => (
    <a href={href} data-transition-types={transitionTypes?.join(" ")} {...props}>
      {children}
    </a>
  ),
}));

import EventManagerLayout from "./layout";

function event(overrides: Partial<EventRow> = {}) {
  return {
    id: EVENT_ID,
    name: "Portfolio Review Night",
    status: "active",
    publish_at: null,
    canceled_at: null,
    requires_application: false,
    teams_enabled: false,
    slug: "portfolio-review-night",
    marketing_url: null,
    configured_marketing_mode: null,
    configured_marketing_url: null,
    starts_at: "2026-11-20T02:00:00.000Z",
    ends_at: "2026-11-20T04:00:00.000Z",
    location_building: "Nest",
    location_room: "2500",
    ...overrides,
  } as EventRow;
}

async function renderAt(pathname: string, param = EVENT_ID) {
  mocks.pathname.current = pathname;
  const result = await EventManagerLayout({
    children: <p>Tab content</p>,
    params: Promise.resolve({ event: param }),
  });
  return render(<>{result}</>);
}

const tabs = () => within(screen.getByRole("navigation", { name: "Event pages" })).getAllByRole("link");
const current = () => tabs().filter((tab) => tab.getAttribute("aria-current") === "page");

beforeEach(() => {
  mocks.guard.mockResolvedValue(undefined);
  mocks.client.mockResolvedValue({});
  mocks.event.mockResolvedValue(event());
  mocks.toReview.mockResolvedValue(new Map([[EVENT_ID, 3]]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("event manager layout", () => {
  it("authorizes before it reads anything", async () => {
    mocks.guard.mockRejectedValueOnce(new Error("Denied"));
    await expect(renderAt(`${BASE}/overview`)).rejects.toThrow("Denied");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it("renders the header, its actions and the page below", async () => {
    await renderAt(`${BASE}/overview`);

    expect(screen.queryByRole("link", { name: "Back to Manage Events" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Portfolio Review Night" })).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^View live site/ }).getAttribute("href")).toBe(
      "/events/portfolio-review-night"
    );
    expect(screen.getByRole("link", { name: "Edit event" }).getAttribute("href")).toBe(`${BASE}/edit`);
    expect(screen.getByRole("link", { name: "Scan tickets" }).getAttribute("href")).toBe(
      `${BASE}/check-in/scan?returnTo=${encodeURIComponent(`${BASE}/overview`)}`
    );
    expect(screen.getByText("Tab content")).toBeTruthy();
  });

  it.each([
    `${BASE}/overview`,
    `${BASE}/agenda`,
    `${BASE}/check-in`,
    `${BASE}/teams`,
    `${BASE}/review-applications`,
  ])("wears the drawer's top bar on %s: close to the list, collapse to the drawer", async (pathname) => {
    mocks.event.mockResolvedValue(event({ teams_enabled: true, requires_application: true }));
    await renderAt(pathname);

    const close = screen.getByRole("link", { name: "Close" });
    expect(close.getAttribute("href")).toBe("/admin/events");
    const collapse = screen.getByRole("link", { name: "Collapse to drawer" });
    expect(collapse.getAttribute("href")).toBe(BASE);
    // One panel holds the bar, the header and the tab, so it can morph.
    const page = collapse.closest('[data-slot="record-page"]') as HTMLElement;
    expect(page).toBeTruthy();
    expect(within(page).getByRole("heading", { level: 1, name: "Portfolio Review Night" })).toBeTruthy();
    expect(within(page).getByText("Tab content")).toBeTruthy();
    // The bar is the way out, so the shell's phone header hides under it.
    expect(page.querySelector("[data-hides-app-header]")).toBeTruthy();
  });

  it("collapses with the morph's transition type where view transitions play", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.assign(document, { startViewTransition: vi.fn() });
    try {
      await renderAt(`${BASE}/check-in`);
      expect(screen.getByRole("link", { name: "Collapse to drawer" }).getAttribute("data-transition-types")).toBe(
        "record-collapse"
      );
    } finally {
      vi.unstubAllGlobals();
      delete (document as { startViewTransition?: unknown }).startViewTransition;
    }
  });

  it("shows Overview, Agenda and Check-in, without Teams or Applications for an event that has neither", async () => {
    await renderAt(`${BASE}/overview`);

    expect(tabs().map((tab) => [tab.textContent, tab.getAttribute("href")])).toEqual([
      ["Overview", `${BASE}/overview`],
      ["Agenda", `${BASE}/agenda`],
      ["Check-in", `${BASE}/check-in`],
    ]);
    expect(mocks.toReview).not.toHaveBeenCalled();
  });

  it("shows Teams only for an event with teams, before Applications", async () => {
    mocks.event.mockResolvedValue(event({ teams_enabled: true, requires_application: true }));
    await renderAt(`${BASE}/teams`);

    expect(tabs().map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Agenda",
      "Check-in",
      "Teams",
      "Applications 3",
    ]);
    expect(current().map((tab) => tab.textContent)).toEqual(["Teams"]);
  });

  it.each([
    [`${BASE}/overview`, "Overview"],
    [`${BASE}/check-in`, "Check-in"],
    [`${BASE}/agenda`, "Agenda"],
    [`${BASE}/review-applications`, "Applications 3"],
    [`${BASE}/review-applications/0b6f8a3e-1d2c-4f5e-9a8b-7c6d5e4f3a2b`, "Applications 3"],
  ])("marks the tab for %s", async (pathname, label) => {
    mocks.event.mockResolvedValue(event({ requires_application: true }));
    await renderAt(pathname);

    expect(current().map((tab) => tab.textContent)).toEqual([label]);
  });

  it("counts the applications waiting for review on the Applications tab", async () => {
    mocks.event.mockResolvedValue(event({ requires_application: true }));
    await renderAt(`${BASE}/overview`);

    const applications = tabs().find((tab) => tab.getAttribute("href") === `${BASE}/review-applications`);
    expect(applications?.textContent).toBe("Applications 3");
    expect(mocks.toReview).toHaveBeenCalledWith({}, [EVENT_ID]);
  });

  it("leaves View live site out when the event has no public page", async () => {
    mocks.event.mockResolvedValue(event({ status: "draft", slug: "" }));
    await renderAt(`${BASE}/overview`);

    expect(screen.queryByRole("link", { name: /View live site|Preview site/ })).toBeNull();
  });

  it("renders a slug's page alone, which redirects to the ID", async () => {
    await renderAt("/admin/events/portfolio-review-night/check-in", "portfolio-review-night");

    expect(screen.getByText("Tab content")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Event pages" })).toBeNull();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it("is a 404 for an event that doesn't exist", async () => {
    mocks.event.mockResolvedValue(null);
    await expect(renderAt(`${BASE}/overview`)).rejects.toThrow("Not found");
  });
});
