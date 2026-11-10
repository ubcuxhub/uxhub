// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewerNotes, formatNoteTime, type ReviewerNote } from "./ReviewerNotes";

afterEach(cleanup);

// 2026-11-09 10:00 AM Pacific (PDT, UTC-7).
const NOW = new Date("2026-11-09T17:00:00Z");

const NOTES: ReviewerNote[] = [
  {
    id: "n1",
    body: "Strong research portfolio.",
    createdAt: "2026-11-08T22:05:00Z",
    author: { id: "jordan", name: "Jordan Lee" },
  },
  {
    id: "n2",
    body: "Leaning accept.",
    createdAt: "2026-11-09T15:00:00Z",
    editedAt: "2026-11-09T15:10:00Z",
    author: { id: "me", name: "Alex Chen" },
  },
  {
    id: "n3",
    body: "Met them at Design Crit Night.",
    createdAt: "2026-10-30T18:00:00Z",
    author: { id: "gone", name: "Sam Rivera", deleted: true },
  },
];

function renderNotes(overrides: Partial<Parameters<typeof ReviewerNotes>[0]> = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };
  render(
    <ReviewerNotes notes={NOTES} currentUserId="me" now={NOW} {...handlers} {...overrides} />,
  );
  return handlers;
}

describe("formatNoteTime", () => {
  const at = (iso: string) => formatNoteTime(iso, NOW.getTime());

  it("says how long ago within the hour", () => {
    expect(at("2026-11-09T16:59:40Z")).toBe("Just now");
    expect(at("2026-11-09T16:48:00Z")).toBe("12 min ago");
  });

  it("counts hours on the same Pacific day", () => {
    expect(at("2026-11-09T14:00:00Z")).toBe("3 hr ago");
  });

  it("names yesterday and earlier days with the time", () => {
    expect(at("2026-11-08T23:05:00Z")).toBe("Yesterday at 4:05 PM");
    expect(at("2026-11-02T16:30:00Z")).toBe("Nov 2 at 9:30 AM");
  });

  it("adds the year for an earlier year", () => {
    expect(at("2025-11-02T16:30:00Z")).toBe("Nov 2, 2025");
  });

  it("treats a clock running slightly ahead as just now", () => {
    expect(at("2026-11-09T17:00:20Z")).toBe("Just now");
  });
});

describe("ReviewerNotes", () => {
  it("lists every note with its author, time and count", () => {
    renderNotes();
    expect(screen.getByRole("heading", { name: "Reviewer notes" })).toBeTruthy();
    expect(screen.getByText(/3 notes · Only admins see these/)).toBeTruthy();
    const items = within(screen.getByRole("list", { name: "Reviewer notes" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Jordan Lee");
    expect(items[0].textContent).toContain("Yesterday at 3:05 PM");
  });

  it("marks your own and edited notes", () => {
    renderNotes();
    const mine = screen.getByText("Leaning accept.").closest("li")!;
    expect(mine.textContent).toContain("Alex Chen (you)");
    expect(mine.textContent).toContain("Edited");
  });

  it("shows a deleted account as Deleted user", () => {
    renderNotes();
    const gone = screen.getByText("Met them at Design Crit Night.").closest("li")!;
    expect(gone.textContent).toContain("Deleted user");
    expect(gone.textContent).not.toContain("Sam Rivera");
  });

  it("offers edit and delete on your own notes only", () => {
    renderNotes();
    expect(screen.getAllByRole("button", { name: "Edit or delete your note" })).toHaveLength(1);
  });

  it("posts a trimmed note and clears the composer", async () => {
    const { onAdd } = renderNotes();
    const composer = screen.getByLabelText("Add a note") as HTMLTextAreaElement;
    const post = screen.getByRole("button", { name: "Post note" }) as HTMLButtonElement;
    expect(post.disabled).toBe(true);

    fireEvent.change(composer, { target: { value: "  Great portfolio  " } });
    fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Great portfolio"));
    await waitFor(() => expect(composer.value).toBe(""));
    expect(screen.getByText("Note posted")).toBeTruthy();
  });

  it("keeps the draft and explains when posting fails", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("offline"));
    renderNotes({ onAdd });
    const composer = screen.getByLabelText("Add a note") as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "Keep me" } });
    fireEvent.click(screen.getByRole("button", { name: "Post note" }));

    expect(await screen.findByText(/Couldn’t post your note/)).toBeTruthy();
    expect(composer.value).toBe("Keep me");
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("says so when there are no notes, and still lets you add one", () => {
    renderNotes({ notes: [] });
    expect(screen.getByText("No notes yet")).toBeTruthy();
    expect(screen.getByText(/0 notes/)).toBeTruthy();
    expect(screen.getByLabelText("Add a note")).toBeTruthy();
  });

  it("shows a busy skeleton while loading, without the composer", () => {
    renderNotes({ status: "loading" });
    expect(screen.getByText("Loading notes")).toBeTruthy();
    expect(screen.queryByLabelText("Add a note")).toBeNull();
  });

  it("offers a retry when notes fail to load", () => {
    const onRetry = vi.fn();
    renderNotes({ status: "error", onRetry });
    expect(screen.getByText("Couldn’t load notes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
