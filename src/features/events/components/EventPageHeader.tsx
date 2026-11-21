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
 * Everything scales with the banner's width (`cqw`, container query width): at
 * the portal page's widest (about 1024 px) the banner is 256 px tall and the
 * icon 96 px, 48 px in from the left and 16 px (1/6 of the icon) below the
 * banner. On narrow banners (under about 600 px, i.e. phones) the icon stops
 * shrinking at 56 px and its inset at 16 px, so it stays legible; the overhang
 * stays 1/6 of the icon. The preview and the page both render through this
 * component, so they still match at any given width. The space for the
 * overhang is part of this component's box, so content after it never runs
 * under the icon.
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
    <div data-slot="event-page-header" className={cn("@container relative [--event-icon:max(9.375cqw,3.5rem)]", className)}>
      <div
        data-slot="event-page-header-banner"
        className="relative aspect-4/1 w-full overflow-hidden rounded-[inherit] bg-muted"
        style={{ backgroundColor: colour || undefined }}
      >
        {imageSrc && <Image src={imageSrc} alt="" fill className="object-cover" unoptimized />}
      </div>
      {showIcon && (
        <>
          {/* The icon's overhang below the banner: 1/6 of the icon. */}
          <div aria-hidden className="h-[calc(var(--event-icon)/6)]" />
          <div
            data-slot="event-page-header-icon"
            className="absolute bottom-0 left-[max(4.6875cqw,1rem)] flex size-(--event-icon) items-center justify-center overflow-hidden rounded-[12.5%] bg-muted"
          >
            {iconSrc ? (
              <Image src={iconSrc} alt="" fill className="object-cover" unoptimized />
            ) : (
              <ImageIcon aria-hidden className="size-1/3 text-muted-foreground" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
