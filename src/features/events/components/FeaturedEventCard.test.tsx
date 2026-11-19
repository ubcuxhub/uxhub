// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FeaturedEventCard } from "./FeaturedEventCard";

afterEach(cleanup);

const props = {
  title: "UX Conference",
  href: "/portal/events/ux-conference",
  colour: "#325DC4",
  image: "https://example.test/header.jpg",
  badge: { label: "Registration open", tone: "success" as const },
};

function card() {
  return screen.getByText("UX Conference").closest('[data-slot="featured-event-card"]') as HTMLElement;
}

it("is one link to the event, named by its title, with its status", () => {
  render(<FeaturedEventCard {...props} />);

  const link = screen.getByRole("link", { name: "UX Conference" });
  expect(link.getAttribute("href")).toBe("/portal/events/ux-conference");
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByText("Registration open")).toBeTruthy();
});

it("shows the image decoratively, over the colour gradient as a fallback", () => {
  render(<FeaturedEventCard {...props} />);

  const image = card().querySelector("img");
  expect(image?.getAttribute("src")).toBe(props.image);
  expect(image?.getAttribute("alt")).toBe("");
  expect(card().style.backgroundImage).toContain("linear-gradient(135deg");
});

it("falls back to the colour gradient alone without an image, and to blue without a colour", () => {
  render(<FeaturedEventCard {...props} image={null} colour={null} />);

  expect(card().querySelector("img")).toBeNull();
  expect(card().style.backgroundImage).toContain("rgb(50, 93, 196)");
});

it("fades in a darker overlay on hover and focus, colour only", () => {
  render(<FeaturedEventCard {...props} />);

  const hover = card().querySelector('[data-slot="featured-event-card-hover"]') as HTMLElement;
  expect(hover.className).toContain("opacity-0");
  expect(hover.className).toContain("group-hover:opacity-100");
  expect(hover.className).toContain("group-has-[a:focus-visible]:opacity-100");
  expect(hover.className).toContain("duration-fast");
  expect(card().className).not.toMatch(/\b(scale|translate|shadow)-/);
});

it("textures only the fade with the dither, not the photo", () => {
  render(<FeaturedEventCard {...props} />);

  const dither = card().querySelector('[data-slot="dither-overlay"]') as HTMLElement;
  expect(dither.getAttribute("aria-hidden")).toBe("true");
  expect(dither.className).toContain("mask-[linear-gradient(179deg,transparent_22%,black_98.6%)]");
});

it("uses dark text on a light event colour", () => {
  render(<FeaturedEventCard {...props} colour="#F5E6F5" />);

  const text = screen.getByText("UX Conference").closest("div") as HTMLElement;
  expect(text.style.color).toBe("rgb(17, 17, 17)");
});
