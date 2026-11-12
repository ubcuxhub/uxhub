// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ReviewerNote } from "@/features/applications/components/ReviewerNotes";

import { ApplicationNotes } from "./ApplicationNotes";

const actions = vi.hoisted(() => ({
  addReviewerNote: vi.fn(),
  editReviewerNote: vi.fn(),
  deleteReviewerNote: vi.fn(),
}));
vi.mock("@/features/admin/reviewer-note-actions", () => actions);

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const note = (id: string, body: string, authorId = "me"): ReviewerNote => ({
  id,
  body,
  createdAt: "2026-11-01T18:00:00Z",
  editedAt: null,
  author: { id: authorId, name: authorId === "me" ? "Alex Chen" : "Jordan Lee", avatarUrl: null },
});

function renderNotes(initial: ReviewerNote[] = []) {
  render(<ApplicationNotes applicationId="app-1" initialNotes={initial} currentUserId="me" />);
}

describe("ApplicationNotes", () => {
  it("shows the loaded thread", () => {
    renderNotes([note("n1", "Strong portfolio"), note("n2", "Agree", "other")]);
    expect(screen.getByText("Strong portfolio")).toBeTruthy();
    expect(screen.getByText("Agree")).toBeTruthy();
  });

  it("posts a note and shows what the server returned", async () => {
    actions.addReviewerNote.mockResolvedValue(note("n9", "Great fit"));
    renderNotes();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great fit" } });
    fireEvent.click(screen.getByRole("button", { name: "Post note" }));
    await waitFor(() => expect(screen.getByText("Great fit")).toBeTruthy());
    expect(actions.addReviewerNote).toHaveBeenCalledWith({ applicationId: "app-1", body: "Great fit" });
  });

  it("keeps the text and shows an error when posting fails", async () => {
    actions.addReviewerNote.mockRejectedValue(new Error("nope"));
    renderNotes();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Post note" }));
    expect(await screen.findByText(/Couldn.t post your note/)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Draft");
  });

  it("offers Edit and Delete only on your own notes", () => {
    renderNotes([note("n1", "Mine"), note("n2", "Theirs", "other")]);
    expect(screen.getAllByRole("button", { name: /Edit or delete your note/ })).toHaveLength(1);
  });
});
