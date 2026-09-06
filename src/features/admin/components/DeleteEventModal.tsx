"use client";

import { AlertTriangle } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface DeleteEventModalProps {
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  error?: string | null;
}

export function DeleteEventModal({
  eventName,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  error,
}: DeleteEventModalProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      icon={<AlertTriangle className="size-4" />}
      title="Delete Event"
      description="Are you sure you want to delete this event? This action cannot be undone."
      confirmation={{
        label: "Confirm the event name",
        placeholder: "Event name",
        // Exact match apart from surrounding whitespace, matching the copy.
        matches: (typed) => typed.trim() === eventName.trim(),
        hint: (
          <>
            Type{" "}
            <span className="font-medium text-foreground">{eventName}</span> to
            delete this event forever.
          </>
        ),
        mismatchMessage: "The event name does not match.",
      }}
      confirmLabel="Confirm"
      pendingLabel="Deleting..."
      error={error}
      pending={isDeleting}
      onConfirm={() => onConfirm()}
    />
  );
}
