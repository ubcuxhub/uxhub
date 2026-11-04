import { Hourglass } from "lucide-react";
import * as React from "react";

import {
  contrastRatio,
  DEFAULT_EVENT_COLOUR,
  eventColourTint,
  normalizeHex,
  readableTextOn,
} from "@/lib/event-colour";
import { cn } from "@/lib/utils";

/** Light-mode `text-foreground`; matches the dark label `readableTextOn` assumes. */
const DARK_LABEL = "#111111";
const LIGHT_LABEL = "#FFFFFF";

/** WCAG AA for the ticket's small text. */
const MIN_CONTRAST = 4.5;
/** How white the top of the fill is at most; the gradient fades from here to the event colour. */
const MAX_TINT = 0.45;

/**
 * The label colour and the fill for an event colour. The label is chosen
 * against the event colour (the bottom of the fill, where it contrasts best),
 * and the white tint at the top is then held back until the label also meets
 * AA against it. So the text passes along the whole gradient, not just at the
 * base: a white label on Blue would otherwise fall to 2.8:1 near the caption.
 * A dark label never needs this, since the tint only lightens the fill.
 */
function ticketAppearance(eventColour: string): {
  label: string;
  fill: string;
  tint: number;
} {
  const colour = normalizeHex(eventColour) ?? DEFAULT_EVENT_COLOUR;
  const light = readableTextOn(colour) === "light";
  const label = light ? LIGHT_LABEL : DARK_LABEL;

  let tint = MAX_TINT;
  if (light) {
    while (
      tint > 0 &&
      contrastRatio(eventColourTint(colour, tint), label) < MIN_CONTRAST
    ) {
      tint = Math.round((tint - 0.01) * 100) / 100;
    }
  }
  return {
    label,
    tint,
    fill: `linear-gradient(to bottom, ${eventColourTint(colour, tint)}, ${colour})`,
  };
}

/**
 * The perforation notches are cut out of the shape, not painted over it, so
 * whatever surface the ticket sits on (page, popover, section panel, either
 * theme) shows through. Two radial masks, each with one hole, intersected.
 */
const NOTCH_X = "calc(75% - 10px)";
const NOTCH_RADIUS = "9px";
const NOTCH_MASK = [["top", "0"], ["bottom", "100%"]]
  .map(
    ([, y]) =>
      `radial-gradient(circle ${NOTCH_RADIUS} at ${NOTCH_X} ${y}, transparent calc(${NOTCH_RADIUS} - 0.5px), #000 ${NOTCH_RADIUS})`,
  )
  .join(", ");
const NOTCH_MASK_STYLE: React.CSSProperties = {
  maskImage: NOTCH_MASK,
  maskComposite: "intersect",
  WebkitMaskImage: NOTCH_MASK,
  WebkitMaskComposite: "source-in",
};

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
  /**
   * A line above the event name, such as "Confirm by Nov 14". Without one,
   * `pending` says "Not confirmed yet" and `used` says "Checked in", so the
   * state never rests on colour alone.
   */
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
 * flip with the theme. It meets AA contrast across the whole gradient (see
 * `ticketAppearance`). The notches are cut out, so the ticket works on any
 * surface.
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
  const { label, fill } = ticketAppearance(eventColour);
  const captionContent =
    caption ?? (pending ? "Not confirmed yet" : used ? "Checked in" : null);
  const stateName = pending ? "not confirmed" : used ? "checked in" : null;

  return (
    <article
      data-slot="ticket"
      data-state={state}
      aria-label={`Ticket for ${eventName}${stateName ? `, ${stateName}` : ""}`}
      className={cn(
        "relative grid aspect-[444/178] w-full max-w-[444px] grid-cols-[1fr_25%]",
        // Greyed, the fill takes on the surface, so the label follows the theme.
        pending && "text-foreground",
        className,
      )}
      style={pending ? style : { color: label, ...style }}
      {...props}
    >
      {/* The fill is clipped to the rounded shape, with the perforation notches masked out of it. */}
      <div
        aria-hidden
        data-slot="ticket-shape"
        className={cn(
          "absolute inset-0 overflow-hidden rounded-xl",
          pending && "opacity-60 grayscale",
        )}
        style={{ background: fill, ...NOTCH_MASK_STYLE }}
      >
        <span className="absolute inset-y-0 right-[calc(25%+10px)] w-0 border-l-2 border-dotted border-current opacity-60" />
      </div>

      <div className="relative flex min-w-0 flex-col items-start justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        {captionContent || action ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {captionContent ? (
              <span
                data-slot="ticket-caption"
                className="inline-flex items-center gap-1 text-label"
              >
                {pending ? <Hourglass className="size-3.5" aria-hidden /> : null}
                {captionContent}
              </span>
            ) : null}
            {action}
          </div>
        ) : (
          <span aria-hidden />
        )}
        <div className="flex min-w-0 max-w-full flex-col gap-0.5">
          <p className="text-label">Ticket</p>
          <p className="truncate text-subheading">{eventName}</p>
          <p className="truncate text-small">{holderName}</p>
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

export { Ticket, ticketAppearance };
