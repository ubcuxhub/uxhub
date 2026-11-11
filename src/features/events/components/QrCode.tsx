import { toQrSvg } from "@/features/events/lib/qr-code";
import { cn } from "@/lib/utils";

/**
 * A check-in code drawn from its token, quiet zone included. Black on
 * transparent: put it on a white tile, since many scanners can't read an
 * inverted code.
 */
export function QrCode({ token, className }: { token: string; className?: string }) {
  const { size, path } = toQrSvg(token);

  return (
    <svg
      role="img"
      aria-label="Check-in QR code"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("text-black", className)}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
