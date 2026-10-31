// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Avatar, AvatarGroup, getInitials } from "./avatar";

afterEach(cleanup);

describe("getInitials", () => {
  it.each([
    ["Alex Chen", "AC"],
    ["alex", "A"],
    ["Mary-Jane O'Neil", "MO"],
    ["Élodie Durand", "ÉD"],
    ["  Ada   Byron   Lovelace ", "AL"],
    ["   ", ""],
    ["", ""],
  ])("%j gives %j", (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});

describe("Avatar", () => {
  it("is an image labelled with the name", () => {
    render(<Avatar name="Alex Chen" />);
    const avatar = screen.getByRole("img", { name: "Alex Chen" });
    expect(avatar).toHaveProperty("dataset.size", "40");
    expect(avatar.textContent).toBe("AC");
  });

  it("hides from assistive tech when decorative", () => {
    render(<Avatar name="Alex Chen" decorative />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows no initials when anonymous", () => {
    render(<Avatar name="Deleted user" anonymous />);
    expect(screen.getByRole("img", { name: "Deleted user" }).textContent).toBe(
      "",
    );
  });
});

const PEOPLE = [
  { name: "Alex Chen" },
  { name: "Sam Lee" },
  { name: "Priya Patel" },
  { name: "Jo Kim" },
  { name: "Mia Wong" },
  { name: "Kat Ng" },
];

describe("AvatarGroup", () => {
  it("shows four faces and +2 for six people", () => {
    const { container } = render(<AvatarGroup people={PEOPLE} />);
    expect(container.querySelectorAll("[data-slot=avatar]")).toHaveLength(4);
    expect(
      container.querySelector("[data-slot=avatar-group-count]")?.textContent,
    ).toBe("+2");
    expect(
      screen.getByRole("img", {
        name: "Alex Chen, Sam Lee, Priya Patel, Jo Kim and 2 others",
      }),
    ).toBeTruthy();
  });

  it("has no count when everyone fits", () => {
    const { container } = render(<AvatarGroup people={PEOPLE.slice(0, 3)} />);
    expect(container.querySelector("[data-slot=avatar-group-count]")).toBeNull();
    expect(
      screen.getByRole("img", { name: "Alex Chen, Sam Lee and Priya Patel" }),
    ).toBeTruthy();
  });

  it("respects max and says 1 other", () => {
    render(<AvatarGroup people={PEOPLE.slice(0, 3)} max={2} />);
    expect(
      screen.getByRole("img", { name: "Alex Chen, Sam Lee and 1 other" }),
    ).toBeTruthy();
  });

  it("labels one and two people plainly", () => {
    render(<AvatarGroup people={PEOPLE.slice(0, 2)} />);
    expect(screen.getByRole("img", { name: "Alex Chen and Sam Lee" })).toBeTruthy();
    cleanup();
    render(<AvatarGroup people={PEOPLE.slice(0, 1)} />);
    expect(screen.getByRole("img", { name: "Alex Chen" })).toBeTruthy();
  });

  it("renders nothing for no people", () => {
    const { container } = render(<AvatarGroup people={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("exposes one image, not one per face", () => {
    render(<AvatarGroup people={PEOPLE} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
