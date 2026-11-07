// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventLeaveDialog } from "./EventLeaveDialog";

afterEach(cleanup);
const navigation = () => ({ open: true, opener: { current: null }, request: vi.fn(), cancel: vi.fn(), leave: vi.fn() });

it("keeps a failed draft save open and leaves only after a successful retry", async () => {
  const guard = navigation();
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<EventLeaveDialog eventName="Design Sprint" navigation={guard} draft pending={false} error={null} save={save} />);
  expect(screen.getByRole("dialog", { name: "Leave without saving?" })).toBeTruthy();
  expect(screen.getByText(/Your changes to Design Sprint/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save draft and leave" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(guard.leave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft and leave" }));
  await waitFor(() => expect(guard.leave).toHaveBeenCalledTimes(1));
});

it("offers explicit discard for live edits without a draft save", () => {
  const guard = navigation();
  render(<EventLeaveDialog eventName="Design Sprint" navigation={guard} draft={false} pending={false} error={null} save={vi.fn()} />);
  expect(screen.getByRole("dialog", { name: "Leave without updating?" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save draft and leave" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }));
  expect(guard.leave).toHaveBeenCalledTimes(1);
});

it("keeps all dismissal paths blocked while saving and shows save errors", () => {
  const guard = navigation();
  render(<EventLeaveDialog eventName="Design Sprint" navigation={guard} draft pending error="Offline" save={vi.fn()} />);
  expect(screen.getByRole("alert").textContent).toBe("Offline");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Leave without saving" }));
  expect(guard.cancel).not.toHaveBeenCalled();
  expect(guard.leave).not.toHaveBeenCalled();
});
