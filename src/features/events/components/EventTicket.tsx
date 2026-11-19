import type { ReactNode } from "react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";

import { DitherOverlay } from "@/components/shared/DitherOverlay";
import { notchMaskStyle, ticketAppearance } from "@/components/shared/Ticket";
import { TicketSheen } from "@/components/shared/TicketSheen";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import { DEFAULT_EVENT_COLOUR } from "@/lib/event-colour";
import { cn } from "@/lib/utils";

import { QrCode } from "./QrCode";
import { TicketFlip } from "./TicketFlip";

export interface EventTicketProps {
  eventName: string;
  holderName: string;
  /** Any hex; defaults to the event Blue, as on the compact `Ticket`. */
  eventColour?: string | null;
  /** The event's image, shown on a white tile. An image icon stands in without one. */
  imageUrl?: string | null;
  /** The ticket's `qr_token`, drawn as the QR code. */
  qrToken: string;
  /**
   * Spin in when it appears, then sway while it's shown: the "Your ticket"
   * pop-up. A plain fade, and no sway, under reduced motion.
   */
  entrance?: boolean;
  className?: string;
}

/** The white label `ticketAppearance` picks for deep colours. */
const LIGHT_LABEL = "#FFFFFF";

/**
 * The scannable ticket in the "Your ticket" dialog (Figma "TicketPass"). The
 * front has the check-in code on a white tile, a perforation, then the event
 * image, the event name and the holder; clicking flips it to the stacked UX
 * Hub logo on the back. 316 × 340 on phones, 420 × 420 from `sm` up. In the
 * pop-up (`entrance`) it spins in once (1600ms, `ease-expressive`), then
 * sways gently on a 6s loop.
 *
 * The fill and label colour come from `ticketAppearance`, so it matches the
 * compact `Ticket` on the event page, and the logo follows the label: white on
 * deep colours, black on pale ones. The notches are cut out of the shape, so
 * the dialog surface shows through in either theme.
 */
export function EventTicket({
  eventName,
  holderName,
  eventColour,
  imageUrl,
  qrToken,
  entrance = false,
  className,
}: EventTicketProps) {
  const { label, fill } = ticketAppearance(eventColour ?? DEFAULT_EVENT_COLOUR);
  const logo = label === LIGHT_LABEL ? "white" : "black";

  return (
    <article
      aria-label={`Ticket for ${eventName}`}
      className={cn(
        // `--notch-y` is where the perforation sits: 244px on phones, 308px from sm.
        "h-[340px] w-[316px] max-w-full [--notch-y:244px] sm:h-[420px] sm:w-[420px] sm:[--notch-y:308px]",
        // The 3D stage for the flip and the entrance (ticket motion spec).
        "perspective-[2400px]",
        className
      )}
      style={{ color: label }}
    >
      <div
        data-slot="event-ticket-card"
        className={cn(
          "size-full transform-3d",
          entrance && "motion-safe:animate-ticket-enter motion-reduce:animate-ticket-fade"
        )}
      >
        <TicketFlip
          className="size-full"
          front={
            <TicketFace fill={fill}>
              {/* The code needs a light ground to scan, so the tile stays white in every theme. */}
              <div className="relative mt-[30px] flex size-[184px] items-center justify-center rounded-xl bg-white sm:mt-10 sm:size-[232px]">
                <QrCode token={qrToken} className="size-[152px] sm:size-[186px]" />
              </div>

              {/* The text (68px) is taller than the image tile, so the row is placed by its centre. */}
              <div className="relative mt-auto mb-3.5 flex w-full items-center gap-4 px-6 sm:mb-[22px]">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-black/60 sm:size-16">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveImagePreviewSrc(imageUrl)} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon aria-hidden className="size-6" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-label">Ticket</p>
                  <p className="truncate text-subheading">{eventName}</p>
                  <p className="truncate text-small">{holderName}</p>
                </div>
              </div>
            </TicketFace>
          }
          back={
            <TicketFace fill={fill}>
              <Image
                src={`/brand/logo-stacked-${logo}.svg`}
                alt="UBC UX Hub"
                width={132}
                height={163}
                className="relative mt-[60px] h-[129px] w-auto sm:mt-[78px] sm:h-[163px]"
              />
            </TicketFace>
          }
        />
      </div>
    </article>
  );
}

/** One side of the ticket: the event-colour fill, dither and sheen, the notches and the perforation. */
function TicketFace({ fill, children }: { fill: string; children: ReactNode }) {
  return (
    <div className="relative flex size-full flex-col items-center">
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{
          background: fill,
          ...notchMaskStyle(
            [
              ["0", "var(--notch-y)"],
              ["100%", "var(--notch-y)"],
            ],
            "12px"
          ),
        }}
      >
        {/* Fill, dither, sheen, then the code and text (design system ticket). */}
        <DitherOverlay />
        <TicketSheen />
        <span className="absolute inset-x-5 top-(--notch-y) border-t-2 border-dashed border-current opacity-80" />
      </div>
      {children}
    </div>
  );
}
