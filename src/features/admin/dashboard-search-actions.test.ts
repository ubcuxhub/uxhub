import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardSearchAction } from "./dashboard-search-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { fetchDashboardSearch, resolveDashboardRecents } from "@/lib/supabase-helpers/dashboard-search";
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase-helpers/dashboard-search", () => ({ fetchDashboardSearch: vi.fn(), resolveDashboardRecents: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { warn: vi.fn() }, errorFields: () => ({}) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({} as Awaited<ReturnType<typeof requireAdmin>>); vi.mocked(fetchDashboardSearch).mockResolvedValue([]); vi.mocked(resolveDashboardRecents).mockResolvedValue([]); });
describe("dashboardSearchAction", () => {
  it("authorizes before accepting direct calls or reading data", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Denied"));
    await expect(dashboardSearchAction({ query: "Alex", scope: "all" })).rejects.toThrow("Denied");
    expect(fetchDashboardSearch).not.toHaveBeenCalled();
    expect(resolveDashboardRecents).not.toHaveBeenCalled();
  });
  it("validates runtime requests and preserves truthful failures", async () => {
    expect(await dashboardSearchAction({ query: "x".repeat(121), scope: "all" })).toHaveProperty("error");
    expect(fetchDashboardSearch).not.toHaveBeenCalled();
    vi.mocked(fetchDashboardSearch).mockRejectedValueOnce(new Error("Private database detail"));
    expect(await dashboardSearchAction({ query: "Alex", scope: "all" })).toEqual({ error: "Couldn’t load search results. Try again." });
  });
});
