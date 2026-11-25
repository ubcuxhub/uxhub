import Link from "next/link";

import { DitherOverlay } from "@/components/shared/DitherOverlay";
import { StatusBadge, type StatusBadgeSpec } from "@/components/ui/status-badge";
import {
  DEFAULT_EVENT_COLOUR,
  featuredCardFade,
  featuredCardGradient,
  readableTextOn,
} from "@/lib/event-colour";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import { cn } from "@/lib/utils";

interface FeaturedEventCardProps {
  title: string;
  href: string;
  /** The event colour; the default blue when unset. */
  colour: string | null;
  /** The header image, else the thumbnail; the colour gradient alone without either. */
  image: string | null;
  badge: StatusBadgeSpec | null;
  className?: string;
}

/**
 * The event Home features (Figma "Featured card"): its image under a fade to
 * the event colour, the dither texture on the fade only, and the title and
 * status badge over it. The whole card is one link, so it is one Tab stop.
 *
 * Hover and keyboard focus fade in a darker copy of the fade (`fast`,
 * `ease-out`; it fades back out on `ease-in`), colour only: no lift, scale or
 * shadow. Focus also shows the 2px ring straight away. Nothing moves, so
 * reduced motion is the same.
 *
 * The colour gradient sits under the image, so an image that fails to load
 * still leaves a finished card.
 */
export function FeaturedEventCard({
  title,
  href,
  colour,
  image,
  badge,
  className,
}: FeaturedEventCardProps) {
  const eventColour = colour ?? DEFAULT_EVENT_COLOUR;
  const textColour = readableTextOn(eventColour) === "light" ? "#FFFFFF" : "#111111";

  return (
    <article
      data-slot="featured-event-card"
      className={cn(
        "group relative isolate flex aspect-[492/309] flex-col justify-end overflow-hidden rounded-xl has-[a:focus-visible]:focus-ring",
        className,
      )}
      style={{ backgroundImage: featuredCardGradient(eventColour) }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded event images aren't on a next/image remote pattern, as in EventCard
        <img
          src={resolveImagePreviewSrc(image)}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: featuredCardFade(eventColour) }} />
      <div
        aria-hidden
        data-slot="featured-event-card-hover"
        className="absolute inset-0 opacity-0 transition-opacity duration-fast ease-in group-hover:opacity-100 group-hover:ease-out group-has-[a:focus-visible]:opacity-100 group-has-[a:focus-visible]:ease-out"
        style={{ backgroundImage: featuredCardFade(eventColour, { darker: true }) }}
      />
      {/* Masked to the fade (FEATURED_FADE_STOPS), so the photo stays clean. */}
      <DitherOverlay className="mask-[linear-gradient(179deg,transparent_22%,black_98.6%)]" />

      <div className="relative flex flex-col items-start gap-2.5 px-7 py-6" style={{ color: textColour }}>
        <h3 className="text-h2 text-pretty break-words">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
          >
            {title}
          </Link>
        </h3>
        {badge ? <StatusBadge {...badge} size="large" /> : null}
      </div>
    </article>
  );
}
