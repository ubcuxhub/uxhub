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

it("stays still: skeletons don't pulse (Portal Motion §2f)", () => {
  const { container } = render(<EventPageSkeleton />);

  for (const block of container.querySelectorAll('[data-slot="skeleton"]')) {
    expect(block.className).not.toMatch(/\banimate-/);
  }
});
