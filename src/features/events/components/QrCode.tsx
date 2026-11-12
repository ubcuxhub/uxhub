import { toQrSvg } from "@/features/events/lib/qr-code";
import { cn } from "@/lib/utils";

export interface QrCodeProps {
  value: string;
  /** Accessible name, such as "Check-in QR code". */
  label: string;
  className?: string;
}

/**
 * `value` drawn as a 192 px QR code. Render it from a server component where
 * possible, so the `qrcode` package stays off the client.
 */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { size, path } = toQrSvg(value);

  return (
    // Stays black on white in dark mode, since many scanners cannot read an
    // inverted code.
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("mx-auto size-48 rounded-lg bg-white text-black", className)}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
