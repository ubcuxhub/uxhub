import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  client: vi.fn(),
  resolve: vi.fn(),
  overview: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Not found");
  }),
}));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/features/admin/lib/resolve-event-param", () => ({ resolveAdminEventId: mocks.resolve }));
vi.mock("@/lib/supabase-helpers/event-teams", () => ({ fetchEventTeamsOverview: mocks.overview }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/admin/components/teams/EventTeamsView", () => ({ EventTeamsView: () => null }));

import EventTeamsPage from "./page";

const page = () => EventTeamsPage({ params: Promise.resolve({ event: "slug" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue(undefined);
  mocks.client.mockResolvedValue({});
  mocks.resolve.mockResolvedValue("event-id");
  mocks.overview.mockResolvedValue({ teamsEnabled: true, teams: [] });
});

it("authorizes before any fetch and resolves a slug to the Teams path", async () => {
  mocks.guard.mockRejectedValueOnce(new Error("Denied"));
  await expect(page()).rejects.toThrow("Denied");
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.overview).not.toHaveBeenCalled();

  const result = await page();
  expect(mocks.resolve).toHaveBeenCalledWith({}, "slug", "/teams");
  expect(mocks.overview).toHaveBeenCalledWith({}, "event-id");
  expect(result.props.children.props.overview).toEqual({ teamsEnabled: true, teams: [] });
});

it("is a 404 for an event that doesn't exist", async () => {
  mocks.overview.mockResolvedValue(null);
  await expect(page()).rejects.toThrow("Not found");
});
