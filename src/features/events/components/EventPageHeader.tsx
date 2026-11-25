import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Width over height of the event page header. The builder's header picker
 * crops uploads to this (`EventBranding`), and the header draws at exactly this
 * shape, so what an admin crops is what students see. The `aspect-4/1` class
 * below must match.
 */
export const EVENT_HEADER_ASPECT = 4;

interface EventPageHeaderProps {
  /** Header image URL, already resolved for display. Drawn over the colour. */
  imageSrc?: string;
  /** Hex fill shown when there is no image (and behind one while it loads). */
  colour?: string;
  /** Icon image URL, already resolved for display. */
  iconSrc?: string;
  /**
   * Draw an empty tile where the icon goes when there is no icon. The builder
   * preview sets it to show the spot; the event page leaves it off.
   */
  iconPlaceholder?: boolean;
  /** Rounds the banner's corners, e.g. `rounded-t-md` inside a card. */
  className?: string;
}

/**
 * The banner at the top of the portal event page: the header image or colour
 * at a fixed 4:1, with the event icon overlapping its bottom-left corner. The
 * event builder's "Header preview" renders this same component, so the two
 * can't crop or place the icon differently.
 *
 * The banner scales with its width; the icon doesn't (Figma 1.3): a 96px tile
 * with 12px corners and a 4px card-coloured border, 32px in from the left so
 * it lines up with the page's text, and hanging half its height (48px) below
 * the banner. Without an icon image it shows a grey image icon. The space for
 * the overhang is part of this component's box, so content after it never
 * runs under the icon.
 */
export function EventPageHeader({
  imageSrc,
  colour,
  iconSrc,
  iconPlaceholder = false,
  className,
}: EventPageHeaderProps) {
  const showIcon = Boolean(iconSrc) || iconPlaceholder;
  return (
    <div data-slot="event-page-header" className={cn("relative", className)}>
      <div
        data-slot="event-page-header-banner"
        className="relative aspect-4/1 w-full overflow-hidden rounded-[inherit] bg-muted"
        style={{ backgroundColor: colour || undefined }}
      >
        {imageSrc && <Image src={imageSrc} alt="" fill className="object-cover" unoptimized />}
      </div>
      {showIcon && (
        <>
          {/* The icon's overhang below the banner: half the icon. */}
          <div aria-hidden className="h-12" />
          <div
            data-slot="event-page-header-icon"
            className="absolute bottom-0 left-8 flex size-24 items-center justify-center overflow-hidden rounded-xl border-4 border-card bg-muted"
          >
            {iconSrc ? (
              <Image src={iconSrc} alt="" fill className="object-cover" unoptimized />
            ) : (
              <ImageIcon aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.5} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
