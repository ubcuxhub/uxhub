import { describe, expect, it } from "vitest";

import {
  clampOffset,
  clampZoom,
  CROP_ZOOM_MAX,
  cropSourceRect,
  displayedSize,
  zoomAboutCentre,
} from "./crop";

const landscape = { width: 1200, height: 800 };
const square = { width: 500, height: 500 };

describe("photo crop geometry", () => {
  it("covers the crop square with the shorter side at zoom 1", () => {
    expect(displayedSize(landscape, 1)).toEqual({ width: 1.5, height: 1 });
    expect(displayedSize(square, 2)).toEqual({ width: 2, height: 2 });
  });

  it("keeps the zoom in range", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(99)).toBe(CROP_ZOOM_MAX);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("never lets the photo uncover the crop square", () => {
    // A 1.5-wide photo can move a quarter either way, and not at all vertically.
    expect(clampOffset({ x: 1, y: 1 }, landscape, 1)).toEqual({ x: 0.25, y: 0 });
    expect(clampOffset({ x: -1, y: 0 }, landscape, 1)).toEqual({ x: -0.25, y: 0 });
    expect(clampOffset({ x: 0.1, y: -0.1 }, square, 2)).toEqual({ x: 0.1, y: -0.1 });
  });

  it("zooms about the centre, then re-clamps", () => {
    expect(zoomAboutCentre({ x: 0.2, y: 0 }, landscape, 1, 2)).toEqual({ x: 0.4, y: 0 });
    // Zooming back out pulls an edge-hugging offset in.
    expect(zoomAboutCentre({ x: 1, y: 0.5 }, square, 3, 1)).toEqual({ x: 0, y: 0 });
  });

  it("maps the crop back to source pixels", () => {
    expect(cropSourceRect(landscape, 1, { x: 0, y: 0 })).toEqual({ x: 200, y: 0, size: 800 });
    // Photo moved right by a quarter: the crop shows its left edge.
    expect(cropSourceRect(landscape, 1, { x: 0.25, y: 0 })).toEqual({ x: 0, y: 0, size: 800 });
    // Zoomed 2x on a square: the middle half.
    expect(cropSourceRect(square, 2, { x: 0, y: 0 })).toEqual({ x: 125, y: 125, size: 250 });
  });
});
