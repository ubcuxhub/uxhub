"use client";

import { useState } from "react";

import {
  addReviewerNote,
  deleteReviewerNote,
  editReviewerNote,
} from "@/features/admin/reviewer-note-actions";
import {
  ReviewerNotes,
  type ReviewerNote,
} from "@/features/applications/components/ReviewerNotes";

interface ApplicationNotesProps {
  applicationId: string;
  /** Oldest first, as loaded on the server. */
  initialNotes: ReviewerNote[];
  /** The signed-in admin's `user_info.id`. */
  currentUserId: string;
}

/**
 * The thread on an application's page. Not optimistic: the thread shows what
 * the server returned, so two reviewers never see a note the other can't. The
 * actions throw on failure, which `ReviewerNotes` shows inline.
 */
export function ApplicationNotes({
  applicationId,
  initialNotes,
  currentUserId,
}: ApplicationNotesProps) {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <ReviewerNotes
      notes={notes}
      currentUserId={currentUserId}
      onAdd={async (body) => {
        const note = await addReviewerNote({ applicationId, body });
        setNotes((current) => [...current, note]);
      }}
      onEdit={async (id, body) => {
        const note = await editReviewerNote({ noteId: id, body });
        setNotes((current) =>
          current.map((existing) => (existing.id === id ? note : existing))
        );
      }}
      onDelete={async (id) => {
        await deleteReviewerNote({ noteId: id });
        setNotes((current) => current.filter((note) => note.id !== id));
      }}
    />
  );
}
