// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamInvite, TeamView } from "../../lib/team-view";
import { TeamCard, type TeamCardProps } from "./TeamCard";

const actions = vi.hoisted(() => ({
  createTeamAction: vi.fn(),
  deleteTeamAction: vi.fn(),
  joinTeamAction: vi.fn(),
  leaveTeamAction: vi.fn(),
  previewTeamAction: vi.fn(),
  renameTeamAction: vi.fn(),
}));
const toastMocks = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toast };
});
const routerMocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("../../team-actions", () => actions);
vi.mock("@/components/ui/toast", () => toastMocks);
vi.mock("@/lib/auth/user-context", () => ({
  useUser: () => ({ user: { first_name: "Aubrey" } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
  usePathname: () => "/portal/events/design-sprint",
}));

const owner: TeamView = {
  id: "team-1",
  displayName: "Pixel Pushers",
  name: "Pixel Pushers",
  inviteCode: "8f2kq01ab3",
  isOwner: true,
  members: [{ key: "0", name: "Aubrey Ventura", isOwner: true, isYou: true }],
};

const member: TeamView = {
  ...owner,
  isOwner: false,
  members: [
    { key: "0", name: "Jordan Lee", isOwner: true, isYou: false },
    { key: "1", name: "Sam Chen", isOwner: false, isYou: false },
    { key: "2", name: "Aubrey Ventura", isOwner: false, isYou: true },
  ],
};

const invite: TeamInvite = {
  inviteCode: "8f2kq01ab3",
  teamName: "Pixel Pushers",
  eventName: "Design Sprint",
  ownerName: "Jordan Lee",
  members: [
    { name: "Jordan Lee", isOwner: true },
    { name: "Sam Chen", isOwner: false },
  ],
  maxSize: 4,
};

function renderCard(props: Partial<TeamCardProps> = {}) {
  return render(
    <TeamCard
      eventId="event-1"
      maxTeamSize={4}
      teamDeadline="2026-11-14T06:59:00Z"
      locked={false}
      team={null}
      origin="https://ubcuxhub.ca"
      invite={null}
      inviteError={null}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("TeamCard", () => {
  it("offers to create or join a team when the student has none (7.1)", () => {
    renderCard();
    expect(screen.getByText("0 of 4 members")).toBeTruthy();
    expect(screen.getByText("You're not on a team yet")).toBeTruthy();
    expect(screen.getByText(/Teams lock on Nov 13 at 11:59 PM\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create team" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join a team" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Manage team/ })).toBeNull();
  });

  it("shows the owner, the spots left and the invite link (7.3)", () => {
    renderCard({ team: owner });
    expect(screen.getByText("1 of 4 members")).toBeTruthy();
    expect(screen.getByText("Pixel Pushers")).toBeTruthy();
    expect(screen.getByText("You · Owner")).toBeTruthy();
    expect(screen.getByText("3 spots left. Share the invite link to fill them.")).toBeTruthy();
    expect(screen.getByDisplayValue("ubcuxhub.ca/join/8f2kq01ab3")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Manage team/ })).toBeTruthy();
  });

  it("labels the owner and the student on someone else's team (7.8)", () => {
    renderCard({ team: member });
    expect(screen.getByText("3 of 4 members")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("1 spot left. Share the invite link to fill it.")).toBeTruthy();
  });

  it("hides the menu and the link once teams lock, and says when (7.11)", () => {
    renderCard({ team: member, locked: true });
    expect(screen.queryByRole("button", { name: /Manage team/ })).toBeNull();
    expect(screen.queryByText("Invite link")).toBeNull();
    expect(screen.queryByText(/spot left/)).toBeNull();
    expect(screen.getByText("Teams locked on Nov 13 at 11:59 PM.")).toBeTruthy();
  });

  it("tells a student with no team that admins will place them (7.10)", () => {
    renderCard({ locked: true });
    expect(screen.getByText("Teams are locked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create team" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Join a team" })).toBeNull();
  });

  it("drops the invite link once the team is full", () => {
    renderCard({ team: member, maxTeamSize: 3 });
    expect(screen.getByText("Your team is full.")).toBeTruthy();
    expect(screen.queryByText("Invite link")).toBeNull();
  });

  it("opens an invite link's team, then clears it from the URL (7.5)", async () => {
    renderCard({ invite });
    expect(await screen.findByRole("dialog", { name: "Join Pixel Pushers?" })).toBeTruthy();
    expect(
      screen.getByText("Jordan Lee invited you to their Design Sprint team. 2 of 4 spots are taken.")
    ).toBeTruthy();
    expect(routerMocks.replace).toHaveBeenCalledWith("/portal/events/design-sprint", { scroll: false });
  });

  it("toasts when the student declines (7.6)", async () => {
    renderCard({ invite });
    fireEvent.click(await screen.findByRole("button", { name: "No, thanks" }));
    expect(toastMocks.toast.info).toHaveBeenCalledWith("Invite declined", {
      description: "You didn't join Pixel Pushers. You can still create your own team or use another invite link.",
    });
    expect(actions.joinTeamAction).not.toHaveBeenCalled();
  });

  it("joins and toasts who's on the team (7.7)", async () => {
    actions.joinTeamAction.mockResolvedValue({ ok: true });
    renderCard({ invite });
    fireEvent.click(await screen.findByRole("button", { name: "Join team" }));
    await waitFor(() =>
      expect(toastMocks.toast.success).toHaveBeenCalledWith("You joined Pixel Pushers", {
        description: "You're on a team with Jordan Lee and Sam Chen.",
      })
    );
    expect(actions.joinTeamAction).toHaveBeenCalledWith({ inviteCode: "8f2kq01ab3" });
  });

  it("shows a refused join in the dialog", async () => {
    actions.joinTeamAction.mockResolvedValue({ ok: false, error: "That team is full." });
    renderCard({ invite });
    fireEvent.click(await screen.findByRole("button", { name: "Join team" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "That team is full.");
    expect(toastMocks.toast.success).not.toHaveBeenCalled();
  });

  it("toasts why an invite link can't be used", async () => {
    renderCard({ inviteError: "That team is full." });
    await waitFor(() =>
      expect(toastMocks.toast.error).toHaveBeenCalledWith("Couldn't open the invite", {
        description: "That team is full.",
      })
    );
  });

  it("looks up a pasted link before asking to join", async () => {
    actions.previewTeamAction.mockResolvedValue({ ok: true, invite });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Join a team" }));
    fireEvent.change(await screen.findByLabelText("Invite link"), {
      target: { value: "https://ubcuxhub.ca/join/8f2kq01ab3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("dialog", { name: "Join Pixel Pushers?" })).toBeTruthy();
    expect(actions.previewTeamAction).toHaveBeenCalledWith({
      eventId: "event-1",
      link: "https://ubcuxhub.ca/join/8f2kq01ab3",
    });
  });

  it("creates a team with the name typed", async () => {
    actions.createTeamAction.mockResolvedValue({ ok: true, teamId: "team-1" });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));
    const field = await screen.findByLabelText("Team name");
    // Unnamed, the team takes the owner's name, so the placeholder says so.
    expect(field.getAttribute("placeholder")).toBe("Aubrey's team");
    // The dialog, not the field, takes focus on open.
    expect(document.activeElement).not.toBe(field);
    fireEvent.change(field, { target: { value: "Pixel Pushers" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Create team" }).at(-1)!);
    await waitFor(() =>
      expect(actions.createTeamAction).toHaveBeenCalledWith({ eventId: "event-1", name: "Pixel Pushers" })
    );
  });
});
