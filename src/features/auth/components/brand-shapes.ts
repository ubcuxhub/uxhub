/**
 * The shape tiles piled in the bottom-left of the auth brand panel, from the
 * Figma "Brand panel / desktop" symbol (4352:1416) and its falling-shapes
 * timeline (4326:2). Geometry is in Figma pixels on the 480px-wide panel and
 * scales with the panel's width; `bottom` is the gap under the tile, so the
 * pile sits on the panel's bottom edge at any height.
 *
 * Listed in Figma's layer order, back to front.
 */
export interface BrandShape {
  name: string;
  src: string;
  /** Left edge, px on a 480px panel. */
  left: number;
  /** Gap below the tile, px on a 480px panel. */
  bottom: number;
  /** Tilt, in degrees, at the top of the fall. */
  tilt: number;
  /** When the tile starts falling, in ms after the panel paints. */
  delay: number;
  /** Length of one slow drift cycle once settled, in ms. */
  drift: number;
}

/** Figma tiles are 128px on the 480px panel. */
export const BRAND_SHAPE_SIZE = 128;
export const BRAND_PANEL_WIDTH = 480;
/** Each tile's fall; the last one lands at 1050 + 900 ≈ 2s. */
export const BRAND_SHAPE_FALL_MS = 900;

export const BRAND_SHAPES: readonly BrandShape[] = [
  { name: "flower", src: "/auth/shapes/flower.png", left: 143, bottom: 126.8, tilt: -20, delay: 870, drift: 11_000 },
  { name: "burst", src: "/auth/shapes/burst.png", left: 281, bottom: 0, tilt: -10, delay: 510, drift: 13_000 },
  { name: "sparkle", src: "/auth/shapes/sparkle.png", left: 136, bottom: 0, tilt: 18, delay: 330, drift: 9_500 },
  { name: "play", src: "/auth/shapes/play.png", left: 10, bottom: 253.2, tilt: 12, delay: 1050, drift: 12_000 },
  { name: "splat", src: "/auth/shapes/splat.png", left: 6, bottom: 125.3, tilt: 8, delay: 690, drift: 10_500 },
  { name: "triangle", src: "/auth/shapes/triangle.png", left: 0, bottom: 0, tilt: -14, delay: 150, drift: 14_000 },
];
