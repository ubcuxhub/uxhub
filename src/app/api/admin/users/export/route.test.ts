import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ current: vi.fn(), client: vi.fn(), rows: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ loadCurrentUser: mocks.current }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase-helpers/user-export", () => ({ fetchUserExport: mocks.rows }));
vi.mock("@/lib/log", () => ({ log: { error: mocks.error }, errorFields: () => ({ errorType: "Error" }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.rows.mockResolvedValue([]); mocks.client.mockResolvedValue("viewer-client"); });

describe("private user export endpoint", () => {
  it.each(["admin", "manager"])("allows %s and sends a private CSV attachment", async (role_access) => {
    mocks.current.mockResolvedValue({ status: "authenticated", user: { role_access } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="uxhub-users.csv"');
    expect(await response.text()).toContain('"Account creation date"');
    expect(mocks.rows).toHaveBeenCalledWith("viewer-client");
  });
  it.each([
    [{ status: "unauthenticated" }, 401],
    [{ status: "needs_profile" }, 401],
    [{ status: "error" }, 503],
    [{ status: "authenticated", user: { role_access: "basic" } }, 403],
  ])("denies direct unauthorized requests", async (current, status) => {
    mocks.current.mockResolvedValue(current);
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rows).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("reports failures without exposing row data, and a subsequent attempt succeeds", async () => {
    mocks.current.mockResolvedValue({ status: "authenticated", user: { role_access: "admin" } });
    mocks.rows.mockRejectedValueOnce(new Error("private email and row data"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("private email");
    expect(mocks.error).toHaveBeenCalledWith("admin.user_export_failed", { errorType: "Error" });
    expect((await GET()).status).toBe(200);
  });
});
