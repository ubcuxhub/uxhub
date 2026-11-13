import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { EventTicket, type EventTicketProps } from "./EventTicket";

export interface TicketDialogProps extends Omit<EventTicketProps, "className"> {
  /** The control that opens it, such as a "View ticket" Button. */
  trigger: ReactNode;
  /** The event's dates, already formatted: "Nov 14 and 28, 2026". */
  dateLabel?: string | null;
}

/**
 * "Your ticket": the scannable `EventTicket` in a dialog, opened from the
 * registration panel. The dialog primitive dims the page, moves focus in, and
 * returns it to the trigger on close; Esc and a click outside close it.
 *
 * 516px wide from `sm` up; on phones it spans the screen with 6px margins.
 * It renders on the server, so the QR code is drawn there and the check-in
 * secret never reaches the browser.
 */
export function TicketDialog({ trigger, dateLabel, ...ticket }: TicketDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[calc(100%-12px)] max-w-[516px] gap-0 p-0">
        <DialogHeader className="space-y-1 px-6 pt-7 sm:px-8">
          <DialogTitle className="text-h2">Your ticket</DialogTitle>
          <DialogDescription className="text-body">
            {[ticket.eventName, dateLabel].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-14 px-6 pt-14 pb-9 sm:px-12 sm:pb-10">
          <EventTicket {...ticket} />
          <p className="text-center text-small text-muted-foreground">
            Show this code at check-in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
