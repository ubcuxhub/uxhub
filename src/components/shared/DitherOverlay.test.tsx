// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DitherOverlay } from "./DitherOverlay";

afterEach(cleanup);

it("renders only the texture by default, so the tickets never glint", () => {
  const { container } = render(<DitherOverlay />);
  expect(container.querySelector('[data-slot="dither-overlay"]')).not.toBeNull();
  expect(container.querySelector('[data-slot="dither-glint"]')).toBeNull();
});

it("adds a glint masked by the dither when reflective, over the texture and hidden from assistive tech", () => {
  const { container } = render(<DitherOverlay reflective />);
  const texture = container.querySelector('[data-slot="dither-overlay"]')!;
  const glint = container.querySelector('[data-slot="dither-glint"]')!;
  expect(glint.getAttribute("aria-hidden")).toBe("true");
  expect(glint.className).toContain("dither-mask.png");
  expect(texture.compareDocumentPosition(glint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
