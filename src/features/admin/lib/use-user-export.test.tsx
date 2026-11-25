// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserExport } from "./use-user-export";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(() => "progress"), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
  fetch: vi.fn(), click: vi.fn(), create: vi.fn(() => "blob:fixture"), revoke: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({ toast: mocks.toast }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: mocks.create, revokeObjectURL: mocks.revoke }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(mocks.click);
  mocks.fetch.mockResolvedValue(new Response("Name\r\nFixture", { headers: { "content-type": "text/csv; charset=utf-8" } }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("user export download", () => {
  it("blocks duplicate attempts, starts the download only after the blob is ready, and permits later exports", async () => {
    let finish!: (value: Response) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(useUserExport);
    act(() => { void result.current.download(); void result.current.download(); });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(result.current.pending).toBe(true);
    expect(mocks.toast).toHaveBeenCalledWith("Preparing user data…", { duration: Infinity });
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.click).not.toHaveBeenCalled();
    await act(async () => { finish(new Response("csv", { headers: { "content-type": "text/csv" } })); });
    expect(mocks.click).toHaveBeenCalledOnce();
    expect(mocks.toast.success).toHaveBeenCalledWith("CSV download started", { id: "progress" });
    expect(result.current.pending).toBe(false);
    await act(async () => { await result.current.download(); });
    expect(mocks.click).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).toHaveBeenLastCalledWith("/api/admin/users/export", { cache: "no-store", signal: expect.any(AbortSignal) });
    await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith("blob:fixture"), { timeout: 2000 });
    expect(document.querySelector("a[download]")).toBeNull();
  });
  it.each(["network", "denied", "html", "body"])("offers working retry for %s failure without success or a file", async (failure) => {
    if (failure === "network") mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    if (failure === "denied") mocks.fetch.mockResolvedValueOnce(new Response("private error", { status: 403 }));
    if (failure === "html") mocks.fetch.mockResolvedValueOnce(new Response("login", { headers: { "content-type": "text/html" } }));
    if (failure === "body") mocks.fetch.mockResolvedValueOnce({ ok: true, headers: new Headers({ "content-type": "text/csv" }), blob: () => Promise.reject(new Error("body interrupted")) });
    const { result } = renderHook(useUserExport);
    await act(async () => { await result.current.download(); });
    expect(mocks.click).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
    const options = mocks.toast.error.mock.calls[0][1];
    expect(options.action.label).toBe("Try again");
    await act(async () => { options.action.onClick(); });
    expect(mocks.click).toHaveBeenCalledOnce();
  });
  it("aborts pending work and suppresses download/feedback when the account session unmounts", async () => {
    let finish!: (value: Response) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result, unmount } = renderHook(useUserExport);
    act(() => { void result.current.download(); });
    const signal = mocks.fetch.mock.calls[0][1].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(new Response("csv", { headers: { "content-type": "text/csv" } })); });
    expect(mocks.click).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("progress");
  });
});
