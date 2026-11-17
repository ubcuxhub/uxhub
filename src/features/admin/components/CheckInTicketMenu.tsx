"use client";

import { useRef, useState, useTransition } from "react";
import { Ellipsis, RefreshCw, TicketX } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  regenerateTicketQrAction,
  voidTicketAction,
  type TicketAdminActionResult,
} from "@/features/admin/actions";

import type { CheckInAttendee } from "../types";

type OpenDialog = "regenerate" | "void" | null;

const FAILED = "Something went wrong. Please try again.";

/**
 * A row's ticket actions on the check-in page: a new QR code for a ticket
 * whose code leaked, or voiding a ticket. Each opens a confirmation; the
 * server decides whether a void is allowed (not after check-in, not while a
 * payment is unrefunded) and the dialog shows its reason when it isn't.
 */
export function CheckInTicketMenu({
  attendee,
  onVoided,
}: {
  attendee: CheckInAttendee;
  /** Removes the row at once; the realtime refetch would follow anyway. */
  onVoided: (ticketId: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<OpenDialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = (next: boolean) => {
    if (next) return;
    setOpen(null);
    setError(null);
  };

  const run = (
    action: () => Promise<TicketAdminActionResult>,
    onSuccess: () => void,
  ) =>
    startTransition(async () => {
      let result: TicketAdminActionResult;
      try {
        result = await action();
      } catch (err) {
        console.error("Ticket action failed:", err);
        result = { ok: false, error: FAILED };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(null);
      setError(null);
      onSuccess();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            ref={triggerRef}
            variant="ghost"
            size="icon-sm"
            label={`Ticket actions for ${attendee.user_name}`}
          >
            <Ellipsis />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            if (open) event.preventDefault();
          }}
        >
          <DropdownMenuItem onSelect={() => setOpen("regenerate")}>
            <RefreshCw aria-hidden />
            Regenerate QR code
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen("void")}>
            <TicketX aria-hidden />
            Void ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={open === "regenerate"}
        onOpenChange={close}
        returnFocusRef={triggerRef}
        title={`Regenerate ${attendee.user_name}’s QR code?`}
        description="Their ticket gets a new code, shown on their event page. The old code, including any screenshot of it, stops working at the door."
        confirmVariant="default"
        confirmLabel="Regenerate code"
        pendingLabel="Regenerating…"
        pending={pending}
        error={error}
        onConfirm={() =>
          run(
            () => regenerateTicketQrAction(attendee.id),
            () => toast.success(`New QR code for ${attendee.user_name}`),
          )
        }
      />

      <ConfirmDialog
        open={open === "void"}
        onOpenChange={close}
        returnFocusRef={triggerRef}
        title={`Void ${attendee.user_name}’s ticket?`}
        description="The ticket stops working and its seat and team spot are freed. This can’t be undone. A paid ticket must be refunded in Square first."
        confirmLabel="Void ticket"
        pendingLabel="Voiding…"
        cancelLabel="Keep ticket"
        pending={pending}
        error={error}
        onConfirm={() =>
          run(
            () => voidTicketAction(attendee.id),
            () => {
              onVoided(attendee.id);
              toast.success(`Voided ${attendee.user_name}’s ticket`);
            },
          )
        }
      />
    </>
  );
}
