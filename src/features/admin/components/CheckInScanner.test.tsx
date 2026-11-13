// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckInAttendee, CheckInSession } from "@/features/admin/types";

const actions = vi.hoisted(() => ({
  checkInScannedTicketAction: vi.fn(),
  checkInTicketAction: vi.fn(),
  fetchAdminCheckInSnapshotAction: vi.fn(),
}));
const pointer = vi.hoisted(() => ({ useCoarsePointer: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
/** The last props the stand-in camera got. */
const camera = vi.hoisted(() => ({
  onScan: (code: string): void => {
    throw new Error(`No camera mounted to scan ${code}`);
  },
  paused: false,
}));

vi.mock("@/features/admin/actions", () => actions);
vi.mock("@/hooks/use-coarse-pointer", () => pointer);
vi.mock("@/components/ui/toast", () => ({ toast }));
vi.mock("@/features/admin/components/QrCameraView", () => ({
  QrCameraView: (props: { paused: boolean; onScan: (code: string) => void }) => {
    camera.onScan = props.onScan;
    camera.paused = props.paused;
    return <div data-testid="camera" />;
  },
}));

import { CheckInScanner } from "./CheckInScanner";

const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const sessions: CheckInSession[] = [
  {
    id: "doors",
    event_id: "event-1",
    name: "Doors",
    start_time: at(-3 * hour),
    end_time: at(-2 * hour),
    created_at: null,
    updated_at: null,
  },
  {
    id: "talks",
    event_id: "event-1",
    name: "Talks",
    start_time: at(-hour),
    end_time: at(hour),
    created_at: null,
    updated_at: null,
  },
];
const ada: CheckInAttendee = {
  id: "ticket-ada",
  user_id: "user-ada",
  user_name: "Ada Lovelace",
  user_email: "ada@student.ubc.ca",
};
const CHECKED_IN_AT = "2026-07-15T17:02:00Z";

function renderScanner(overrides: { sessions?: CheckInSession[] } = {}) {
  return render(
    <CheckInScanner
      eventId="event-1"
      eventName="Design Sprint"
      sessions={overrides.sessions ?? sessions}
      initialAttendees={[ada]}
      phoneLink={<svg data-testid="phone-link" />}
    />
  );
}

async function scan(code: string) {
  await act(async () => camera.onScan(code));
}

beforeEach(() => {
  vi.clearAllMocks();
  pointer.useCoarsePointer.mockReturnValue(true);
  actions.checkInScannedTicketAction.mockResolvedValue({
    status: "checked_in",
    name: "Ada Lovelace",
    checkedInAt: CHECKED_IN_AT,
  });
  actions.checkInTicketAction.mockResolvedValue({
    status: "checked_in",
    name: "Ada Lovelace",
    checkedInAt: CHECKED_IN_AT,
  });
  actions.fetchAdminCheckInSnapshotAction.mockResolvedValue({
    sessions,
    attendees: [ada],
    statuses: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CheckInScanner", () => {
  it("asks to be opened on a phone when there is no touch screen", () => {
    pointer.useCoarsePointer.mockReturnValue(false);
    renderScanner();

    expect(screen.getByText("Open this on your phone"));
    expect(screen.getByTestId("phone-link"));
    expect(screen.queryByTestId("camera")).toBeNull();
  });

  it("renders no scanner until it knows the device", () => {
    pointer.useCoarsePointer.mockReturnValue(null);
    renderScanner();

    expect(screen.queryByTestId("camera")).toBeNull();
    expect(screen.queryByText("Open this on your phone")).toBeNull();
  });

  it("explains that a session is needed when the event has none", () => {
    renderScanner({ sessions: [] });

    expect(screen.getByText("No check-in sessions"));
    expect(screen.queryByTestId("camera")).toBeNull();
  });

  it("checks a scanned code in to the session running now and shows who it was", async () => {
    renderScanner();

    await scan("9f86d081884c7d659a2feaa0c55ad015");

    expect(actions.checkInScannedTicketAction).toHaveBeenCalledWith(
      "talks",
      "9f86d081884c7d659a2feaa0c55ad015"
    );
    const result = await screen.findByRole("region", { name: "Check-in result" });
    expect(result.dataset.status).toBe("checked_in");
    expect(result.textContent).toContain("Ada Lovelace");
    expect(result.textContent).toContain("Checked in");
    expect(camera.paused).toBe(true);
  });

  it("submits each code once while its result is showing", async () => {
    renderScanner();

    await scan("code-1");
    await screen.findByRole("region", { name: "Check-in result" });
    await scan("code-1");
    await scan("code-2");

    expect(actions.checkInScannedTicketAction).toHaveBeenCalledTimes(1);
  });

  it("scans the next ticket after Scan next, ignoring the last code for a moment", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    renderScanner();

    await scan("code-1");
    fireEvent.click(await screen.findByRole("button", { name: "Scan next" }));
    expect(camera.paused).toBe(false);

    await scan("code-1");
    expect(actions.checkInScannedTicketAction).toHaveBeenCalledTimes(1);

    await scan("code-2");
    expect(actions.checkInScannedTicketAction).toHaveBeenLastCalledWith("talks", "code-2");
    fireEvent.click(await screen.findByRole("button", { name: "Scan next" }));

    now.mockReturnValue(1_000_000 + 5000);
    await scan("code-2");
    expect(actions.checkInScannedTicketAction).toHaveBeenCalledTimes(3);
  });

  it("shows the first time when a ticket was already checked in", async () => {
    actions.checkInScannedTicketAction.mockResolvedValue({
      status: "already_checked_in",
      name: "Ada Lovelace",
      checkedInAt: CHECKED_IN_AT,
    });
    renderScanner();

    await scan("code-1");

    const result = await screen.findByRole("region", { name: "Check-in result" });
    expect(result.dataset.status).toBe("already_checked_in");
    expect(result.textContent).toContain("Already checked in at 10:02 AM");
  });

  it("says why a code was rejected", async () => {
    actions.checkInScannedTicketAction.mockResolvedValue({
      status: "rejected",
      reason: "wrong_event",
    });
    renderScanner();

    await scan("code-1");

    const result = await screen.findByRole("region", { name: "Check-in result" });
    expect(result.dataset.status).toBe("rejected");
    expect(result.textContent).toContain("Ticket is for a different event");
  });

  it("goes back to scanning and allows a retry when the check-in fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    actions.checkInScannedTicketAction.mockRejectedValueOnce(new Error("offline"));
    renderScanner();

    await scan("code-1");

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(camera.paused).toBe(false);
    expect(screen.queryByRole("region", { name: "Check-in result" })).toBeNull();

    await scan("code-1");
    expect(actions.checkInScannedTicketAction).toHaveBeenCalledTimes(2);
    await screen.findByRole("region", { name: "Check-in result" });
  });

  it("checks in someone picked by name when their code won't scan", async () => {
    renderScanner();

    fireEvent.click(screen.getByRole("button", { name: "Can't scan?" }));
    expect(screen.queryByTestId("camera")).toBeNull();
    expect(actions.fetchAdminCheckInSnapshotAction).toHaveBeenCalledWith("event-1");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search by name or email" }), {
      target: { value: "lovelace" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Check in Ada Lovelace/ }));

    await waitFor(() =>
      expect(actions.checkInTicketAction).toHaveBeenCalledWith("talks", "ticket-ada")
    );
    const result = await screen.findByRole("region", { name: "Check-in result" });
    expect(result.textContent).toContain("Ada Lovelace");

    fireEvent.click(screen.getByRole("button", { name: "Scan next" }));
    expect(screen.getByTestId("camera"));
  });

  it("finds tickets bought after the page loaded", async () => {
    const grace: CheckInAttendee = {
      id: "ticket-grace",
      user_id: "user-grace",
      user_name: "Grace Hopper",
      user_email: "grace@example.com",
    };
    actions.fetchAdminCheckInSnapshotAction.mockResolvedValue({
      sessions,
      attendees: [ada, grace],
      statuses: [],
    });
    renderScanner();

    fireEvent.click(screen.getByRole("button", { name: "Can't scan?" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search by name or email" }), {
      target: { value: "grace" },
    });

    expect(await screen.findByRole("button", { name: /Check in Grace Hopper/ }));
  });
});
