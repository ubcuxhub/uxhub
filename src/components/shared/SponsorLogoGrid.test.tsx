// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SponsorLogoGrid } from "./SponsorLogoGrid";

afterEach(cleanup);

describe("SponsorLogoGrid", () => {
  it("names every tile while keeping its logo decorative", () => {
    const { container } = render(
      <SponsorLogoGrid
        sponsors={[
          {
            name: "Microsoft",
            href: "https://microsoft.com",
            logoSrc: "/sponsor-logos/microsoft.svg",
          },
          {
            name: "Notion",
            href: "https://notion.so",
            logoSrc: "/sponsor-logos/notion.svg",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Microsoft" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Notion" })).toBeTruthy();
    expect(container.querySelectorAll("img[alt='']")).toHaveLength(2);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
