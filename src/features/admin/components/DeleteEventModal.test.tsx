// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DeleteEventModal } from "./DeleteEventModal";
vi.mock("@/features/admin/actions", () => ({ loadAdminEventDeletionInfoAction: vi.fn(async () => ({ name: "Workshop", registered: 2, checkedIn: 1, teams: 0, protectedPurchases: 0 })) }));
afterEach(cleanup);
it("explains attendance protection and offers no destructive confirmation", async () => {
  render(<DeleteEventModal eventId="event" eventName="Workshop" isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);
  expect(await screen.findByText("This event can’t be deleted")).toBeTruthy();
  expect(screen.getByText(/Attendance has been recorded for 1 attendee/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Delete event" })).toBeNull();
});
