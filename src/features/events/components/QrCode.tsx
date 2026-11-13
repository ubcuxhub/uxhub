import { toQrSvg } from "@/features/events/lib/qr-code";
import { cn } from "@/lib/utils";

/**
 * `token` drawn as a QR code, quiet zone included. Black on transparent: put
 * it on a white tile (or give it `bg-white`), since many scanners can't read
 * an inverted code. Render it from a server component where possible, so the
 * `qrcode` package stays off the client.
 */
export function QrCode({
  token,
  label = "Check-in QR code",
  className,
}: {
  token: string;
  /** Accessible name. Defaults to "Check-in QR code". */
  label?: string;
  className?: string;
}) {
  const { size, path } = toQrSvg(token);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("text-black", className)}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
