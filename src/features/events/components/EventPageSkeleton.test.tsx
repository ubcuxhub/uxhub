// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { EventPageSkeleton } from "./EventPageSkeleton";

afterEach(cleanup);

it("announces loading once and hides the placeholder blocks", () => {
  const { container } = render(<EventPageSkeleton />);

  expect(screen.getByRole("status").textContent).toBe("Loading event");
  expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");

  const blocks = container.querySelectorAll('[data-slot="skeleton"]');
  expect(blocks.length).toBeGreaterThan(0);
  for (const block of blocks) expect(block.getAttribute("aria-hidden")).toBe("true");
});

it("pulses faintly, and not at all under reduced motion", () => {
  const { container } = render(<EventPageSkeleton />);
  const block = container.querySelector('[data-slot="skeleton"]');

  expect(block?.className).toContain("animate-skeleton-pulse");
  expect(block?.className).toContain("motion-reduce:animate-none");
  expect(block?.className).not.toContain("animate-pulse ");
});
