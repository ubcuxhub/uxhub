// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import type { MentorRow } from "@/lib/supabase/models";

import { EventPeopleCard } from "./EventPeopleCard";

afterEach(cleanup);

const person = (over: Partial<MentorRow>) =>
  ({ id: "p1", full_name: "Grace Hopper", position: null, description: null, profile_image_path: null, linkedin_url: null, ...over }) as MentorRow;

it.each(["Mentors", "Judges", "Organizers"])("shows each person's description in a %s section", (title) => {
  render(<EventPeopleCard type="people" title={title} people={[person({ position: "Admiral", description: "Invented the compiler." })]} />);
  expect(screen.getByText("Admiral")).toBeTruthy();
  expect(screen.getByText("Invented the compiler.")).toBeTruthy();
});

it("leaves the line out without a description", () => {
  const { container } = render(<EventPeopleCard type="people" title="Judges" people={[person({})]} />);
  expect(container.querySelectorAll(".whitespace-pre-line")).toHaveLength(0);
});
