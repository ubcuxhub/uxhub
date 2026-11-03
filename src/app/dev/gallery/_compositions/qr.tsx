import { toQrSvg } from "@/features/events/lib/qr-code";

/** A real QR code from the app's own encoder, for a ticket's code slot. */
export function QrCode({ value }: { value: string }) {
  const { size, path } = toQrSvg(value);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-full"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
