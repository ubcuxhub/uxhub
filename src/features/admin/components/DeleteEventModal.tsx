"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

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
  const [confirmText, setConfirmText] = useState("");
  const isValid = confirmText.trim() === eventName.trim();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm();
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <Card
        className="mx-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle />
            Delete Event
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-small text-muted-foreground">
            <p>
              Are you sure you want to delete this event? This action cannot be
              undone.
            </p>
            <p>
              Type in the event name <strong>{eventName}</strong> to delete
              this event forever.
            </p>
          </div>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Event name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
              className={!isValid && confirmText ? "border-destructive" : ""}
            />
            {!isValid && confirmText && (
              <p className="text-small text-destructive">
                The event name does not match.
              </p>
            )}
            {error && (
              <p className="text-small text-destructive">{error}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!isValid || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
