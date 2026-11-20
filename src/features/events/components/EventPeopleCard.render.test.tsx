// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MentorRow, SponsorRow } from "@/lib/supabase/models";

import { EventPeopleCard } from "./EventPeopleCard";

afterEach(cleanup);

const judge = {
  id: "m1",
  full_name: "Sarah Jenkins",
  position: "Senior Product Designer at Stripe",
  profile_image_path: null,
  linkedin_url: "https://www.linkedin.com/in/sarah",
} as MentorRow;

const sponsor = {
  id: "s1",
  name: "Harvest & Co.",
  description: "Artisanal food sponsor",
  website_url: "https://harvest.example.com",
  brand_logo_path: null,
} as SponsorRow;

describe("EventPeopleCard", () => {
  it("counts the section under its title and links LinkedIn", () => {
    render(<EventPeopleCard type="people" title="Judges" people={[judge, { ...judge, id: "m2" }]} />);
    expect(screen.getByRole("heading", { name: "Judges" })).toBeTruthy();
    expect(screen.getByText("2 judges")).toBeTruthy();
    expect(screen.getAllByText("SJ")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Sarah Jenkins on LinkedIn (opens in a new tab)" })).toHaveLength(2);
  });

  it("shows a sponsor's description and website", () => {
    render(<EventPeopleCard type="sponsors" people={[sponsor]} />);
    expect(screen.getByText("1 sponsor")).toBeTruthy();
    expect(screen.getByText("Artisanal food sponsor")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Harvest & Co\. website/ }).getAttribute("href")).toBe(sponsor.website_url);
  });

  it("drops a website that isn't a safe http(s) link", () => {
    render(<EventPeopleCard type="sponsors" people={[{ ...sponsor, website_url: "javascript:alert(1)" }]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
