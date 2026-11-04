"use client";

import { useEffect, useId, useRef } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SuccessOverlayProps {
  message: string;
  onClose: () => void;
}

/**
 * A modal confirmation: the panel takes focus on mount and hands it back when
 * it goes, Tab stays on its one control, and Esc, the Close button or a click
 * on the scrim dismiss it. It is named and described for screen readers, which
 * announce it as a dialog as soon as it appears.
 *
 * It stays in the page flow (`fixed inset-0`, no portal) so the gallery can
 * draw it inside a transformed frame.
 */
export function SuccessOverlay({ message, onClose }: SuccessOverlayProps) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        // The Close button is the only control, so Tab has nowhere else to go.
        if (event.key !== "Tab") return;
        event.preventDefault();
        closeRef.current?.focus();
      }}
    >
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="mx-4 w-full max-w-md outline-none"
      >
        <CardHeader>
          <CardTitle
            id={titleId}
            className="flex items-center gap-2 text-success-foreground"
          >
            <Check aria-hidden />
            Success
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p id={messageId} className="text-small text-muted-foreground">
            {message}
          </p>
          <div className="flex justify-end">
            <Button
              ref={closeRef}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
