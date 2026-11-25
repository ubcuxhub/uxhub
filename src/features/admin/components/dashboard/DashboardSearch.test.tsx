// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSearch } from "./DashboardSearch";
import { dashboardSearchAction } from "@/features/admin/dashboard-search-actions";
import type { DashboardSearchResult } from "@/features/admin/lib/dashboard-search";

const mocks = vi.hoisted(() => ({ push: vi.fn(), download: vi.fn(), pending: false, user: { id: "admin" } as { id: string } | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock("@/features/admin/dashboard-search-actions", () => ({ dashboardSearchAction: vi.fn() }));
vi.mock("@/features/admin/lib/use-user-export", () => ({ useUserExport: () => ({ download: mocks.download, pending: mocks.pending }) }));
const action = vi.mocked(dashboardSearchAction);
const person: DashboardSearchResult = { kind: "user", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", label: "Alex", description: "alex@example.test" };
beforeEach(() => {
  mocks.download.mockReset(); mocks.pending = false;
  sessionStorage.clear(); mocks.user = { id: "admin" }; mocks.push.mockReset(); action.mockReset();
  action.mockResolvedValue({ results: [], recents: [] });
});
afterEach(cleanup);
async function open() { fireEvent.focus(screen.getByRole("combobox")); await screen.findByRole("option", { name: "Upcoming events" }); }
describe("DashboardSearch", () => {
  it("dispatches export by keyboard independently of typed search and disables only while pending", async () => {
    const { rerender } = render(<DashboardSearch userId="admin" sessionKey="login-1" />);
    await open();
    const input = screen.getByRole("combobox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "export" } });
    await screen.findByRole("option", { name: "Export user data" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.download).toHaveBeenCalledWith();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(input);
    mocks.pending = true;
    rerender(<DashboardSearch userId="admin" sessionKey="login-1" />);
    fireEvent.focus(input);
    const item = await screen.findByRole("option", { name: /Export user data/ });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(item);
    expect(mocks.download).toHaveBeenCalledOnce();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("dispatches working statistics and scoped searches", async () => {
    const scroll = vi.fn();
    render(<><DashboardSearch userId="admin" sessionKey="login-1" /><h2 id="statistics-heading" tabIndex={-1} ref={(node) => { if (node) node.scrollIntoView = scroll; }}>Statistics</h2></>);
    await open();
    expect(screen.getByRole("option", { name: /Export user data/ }).getAttribute("aria-disabled")).toBe(null);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "statistics" } });
    fireEvent.click(await screen.findByRole("option", { name: "Club statistics" }));
    expect(scroll).toHaveBeenCalledOnce();
    expect(document.activeElement?.id).toBe("statistics-heading");
    expect(sessionStorage.getItem("uxhub:dashboard-search:admin:login-1")).toContain('"id":"statistics"');
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    await open();
    fireEvent.click(screen.getByRole("option", { name: "Pending applications" }));
    await waitFor(() => expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "pending" })));
    fireEvent.click(screen.getByRole("button", { name: "Back to all results" }));
    await screen.findByRole("option", { name: "Upcoming events" });
    fireEvent.click(screen.getByRole("option", { name: "Upcoming events" }));
    await waitFor(() => expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "upcoming" })));
  });
  it("ignores stale success/failure responses and revalidates before record navigation", async () => {
    render(<DashboardSearch userId="admin" sessionKey="login-1" />);
    await open();
    let finishOld!: (value: { error: string }) => void;
    action.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "old" } });
    await waitFor(() => expect(finishOld).toBeTypeOf("function"));
    action.mockResolvedValue({ results: [person], recents: [] });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Alex" } });
    await screen.findByRole("option", { name: /Alex/ });
    finishOld({ error: "Old failure" });
    await waitFor(() => expect(screen.queryByText("Old failure")).toBeNull());
    action.mockResolvedValueOnce({ results: [], recents: [person] });
    fireEvent.click(screen.getByRole("option", { name: /Alex/ }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/admin/users/${person.id}`));
    expect(sessionStorage.getItem("uxhub:dashboard-search:admin:login-1")).not.toContain("Alex");
  });
  it("isolates logins/accounts, resolves only references and removes unavailable recents", async () => {
    sessionStorage.setItem("uxhub:dashboard-search:admin:login-1", JSON.stringify([person]));
    const { rerender } = render(<DashboardSearch userId="admin" sessionKey="login-1" />);
    await open();
    expect(action).toHaveBeenLastCalledWith({ query: "", scope: "all", recents: [{ kind: "user", id: person.id }] });
    expect(sessionStorage.getItem("uxhub:dashboard-search:admin:login-1")).toBe("[]");
    rerender(<DashboardSearch userId="admin" sessionKey="login-2" />);
    await open();
    expect(action).toHaveBeenLastCalledWith({ query: "", scope: "all", recents: [] });
    mocks.user = { id: "other" };
    rerender(<DashboardSearch userId="admin" sessionKey="login-2" />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("shows failed lookups with a working retry and never navigates deleted selections", async () => {
    action.mockResolvedValueOnce({ error: "Try later" });
    render(<DashboardSearch userId="admin" sessionKey="login-1" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByText("Try later")).toBeTruthy();
    action.mockResolvedValue({ results: [], recents: [] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("option", { name: "Upcoming events" });
    action.mockResolvedValueOnce({ results: [person], recents: [] });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Alex" } });
    fireEvent.click(await screen.findByRole("option", { name: /Alex/ }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /Alex/ })).toBeNull());
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
