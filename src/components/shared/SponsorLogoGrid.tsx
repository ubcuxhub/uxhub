import * as React from "react";

import { cn } from "@/lib/utils";

interface SponsorLogoGridProps
  extends Omit<React.ComponentProps<"ul">, "children"> {
  sponsors: readonly {
    name: string;
    href: string;
    logoSrc: string;
  }[];
}

/** Responsive linked sponsor tiles. Logos remain on white in every theme. */
function SponsorLogoGrid({
  sponsors,
  className,
  ...props
}: SponsorLogoGridProps) {
  return (
    <ul
      data-slot="sponsor-logo-grid"
      className={cn(
        "grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 lg:grid-cols-5",
        className,
      )}
      {...props}
    >
      {sponsors.map((sponsor) => (
        <li key={`${sponsor.name}-${sponsor.href}`}>
          <a
            href={sponsor.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={sponsor.name}
            className="flex h-28 items-center justify-center rounded-xl border border-border-subtle bg-white p-4 focus-visible:focus-ring"
          >
            <span className="sr-only">{sponsor.name}</span>
            {/* Sponsor artwork keeps its original colours; the image is decorative because the link is named. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sponsor.logoSrc}
              alt=""
              className="h-12 w-[120px] max-w-full object-contain"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

export { SponsorLogoGrid };
export type { SponsorLogoGridProps };
