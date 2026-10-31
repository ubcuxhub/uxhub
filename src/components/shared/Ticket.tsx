import * as React from "react";

import {
  DEFAULT_EVENT_COLOUR,
  readableTextOn,
  ticketGradient,
} from "@/lib/event-colour";
import { cn } from "@/lib/utils";

/** Light-mode `text-foreground`; matches the dark label `readableTextOn` assumes. */
const DARK_LABEL = "#111111";
const LIGHT_LABEL = "#FFFFFF";

export interface TicketProps
  extends Omit<React.ComponentProps<"article">, "children"> {
  eventName: string;
  holderName: string;
  /** Any hex. Defaults to the event Blue. */
  eventColour?: string;
  /**
   * `active` shows the code. `pending` (accepted, not yet confirmed) is greyed
   * and shows no code, since none exists yet. `used` (checked in) dims the code.
   */
  state?: "active" | "pending" | "used";
  /** The QR slot, drawn inside a 72px white tile. Ignored while `pending`. */
  code?: React.ReactNode;
  /** A line above the event name, such as "Confirm by Nov 14". `used` falls back to "Checked in". */
  caption?: React.ReactNode;
  /** An optional action, such as a "View ticket" Button. */
  action?: React.ReactNode;
}

/**
 * The compact member ticket (§2.1, §4.3): a 444x178 stub filled with the event
 * colour, with "Ticket", the event name and the holder on the left, and a QR
 * tile behind a dotted perforation on the right. It is not the scannable
 * detail view; that is `EventTicket`, which can fill the code slot.
 *
 * The label colour follows the event colour, since it is user data and does not
 * flip with the theme.
 */
function Ticket({
  eventName,
  holderName,
  eventColour = DEFAULT_EVENT_COLOUR,
  state = "active",
  code,
  caption,
  action,
  className,
  style,
  ...props
}: TicketProps) {
  const pending = state === "pending";
  const used = state === "used";
  const label =
    readableTextOn(eventColour) === "light" ? LIGHT_LABEL : DARK_LABEL;
  const captionContent = caption ?? (used ? "Checked in" : null);

  return (
    <article
      data-slot="ticket"
      data-state={state}
      aria-label={`Ticket for ${eventName}`}
      className={cn(
        "relative grid aspect-[444/178] w-full max-w-[444px] grid-cols-[1fr_25%]",
        // Greyed, the fill takes on the surface, so the label follows the theme.
        pending && "text-foreground",
        className,
      )}
      style={pending ? style : { color: label, ...style }}
      {...props}
    >
      {/* The fill and the perforation notches are clipped to the rounded shape. */}
      <div
        aria-hidden
        data-slot="ticket-shape"
        className={cn(
          "absolute inset-0 overflow-hidden rounded-xl",
          pending && "opacity-60 grayscale",
        )}
        style={{ background: ticketGradient(eventColour) }}
      >
        <span className="absolute inset-y-0 right-[calc(25%+10px)] w-0 border-l-2 border-dotted border-current opacity-60" />
        <span className="absolute right-[calc(25%+10px)] top-0 size-[18px] translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute right-[calc(25%+10px)] bottom-0 size-[18px] translate-x-1/2 translate-y-1/2 rounded-full bg-background" />
      </div>

      <div className="relative flex min-w-0 flex-col items-start justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        {captionContent || action ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {captionContent ? (
              <span data-slot="ticket-caption" className="text-label">
                {captionContent}
              </span>
            ) : null}
            {action}
          </div>
        ) : (
          <span aria-hidden />
        )}
        <div className="flex min-w-0 max-w-full flex-col gap-0.5">
          <p className="text-label opacity-85">Ticket</p>
          <p className="truncate text-subheading">{eventName}</p>
          <p className="truncate text-small opacity-85">{holderName}</p>
        </div>
      </div>

      <div
        data-slot="ticket-code"
        className="relative flex items-center justify-center"
      >
        {pending ? (
          <span
            aria-hidden
            className="aspect-square w-[65%] max-w-18 rounded-xl border border-dashed border-current opacity-50"
          />
        ) : (
          // The code needs a light ground to scan, so this tile stays white in every theme.
          <span
            className={cn(
              "flex aspect-square w-[65%] max-w-18 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-white text-black",
              used && "opacity-50",
            )}
          >
            {code}
          </span>
        )}
      </div>
    </article>
  );
}

export { Ticket };
