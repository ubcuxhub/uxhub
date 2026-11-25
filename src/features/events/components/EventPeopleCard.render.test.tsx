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
  description: null,
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

const person = (over: Partial<MentorRow>) =>
  ({ id: "p1", full_name: "Grace Hopper", position: null, description: null, profile_image_path: null, linkedin_url: null, ...over }) as MentorRow;

describe("EventPeopleCard", () => {
  it("counts the section under its title and links LinkedIn", () => {
    render(<EventPeopleCard type="people" title="Judges" people={[judge, { ...judge, id: "m2" }]} />);
    expect(screen.getByRole("heading", { name: "Judges" })).toBeTruthy();
    expect(screen.getByText("2 judges")).toBeTruthy();
    expect(screen.getAllByText("SJ")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Sarah Jenkins on LinkedIn (opens in a new tab)" })).toHaveLength(2);
  });

  it.each(["Mentors", "Judges", "Organizers"])("shows each person's description in a %s section", (title) => {
    render(<EventPeopleCard type="people" title={title} people={[person({ position: "Admiral", description: "Invented the compiler." })]} />);
    expect(screen.getByText("Admiral")).toBeTruthy();
    expect(screen.getByText("Invented the compiler.")).toBeTruthy();
  });

  it("leaves the line out without a description", () => {
    const { container } = render(<EventPeopleCard type="people" title="Judges" people={[person({})]} />);
    expect(container.querySelectorAll(".whitespace-pre-line")).toHaveLength(0);
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
