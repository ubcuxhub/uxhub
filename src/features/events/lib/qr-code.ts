import { create } from "qrcode";

// Scanners need a blank border of at least four modules to find the code.
const QUIET_ZONE = 4;

export interface QrSvg {
  /** Width and height of the SVG viewBox, quiet zone included. */
  size: number;
  /** SVG path with one unit square per dark module. */
  path: string;
}

/** Encodes `value` as a QR code drawn on a grid of one-unit modules. */
export function toQrSvg(value: string): QrSvg {
  const { modules } = create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) {
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }
  return { size: modules.size + QUIET_ZONE * 2, path };
}
