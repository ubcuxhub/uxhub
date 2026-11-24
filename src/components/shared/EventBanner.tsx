"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

/** Decorative event artwork; its frame never moves and failed URLs use the fallback. */
export function EventBanner({ src, colour }: { src?: string | null; colour?: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <div data-slot="event-banner" aria-hidden="true" style={colour ? { backgroundColor: colour } : undefined}
    className="group flex h-50 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
    {src && failedSrc !== src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" onError={() => setFailedSrc(src)} className="size-full object-cover transition-transform duration-slow ease-out motion-safe:group-hover:scale-105 motion-reduce:transition-none" />
    ) : !colour ? <CalendarDays className="size-5 text-muted-foreground" /> : null}
  </div>;
}
