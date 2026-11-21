// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CheckInAttendee } from "@/features/admin/types";

import { CheckInLookup } from "./CheckInLookup";

afterEach(cleanup);

function attendee(index: number): CheckInAttendee {
  return {
    id: `ticket-${index}`,
    user_id: `user-${index}`,
    user_name: `Student ${index}`,
    user_email: `student${index}@student.ubc.ca`,
  };
}

function search(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search by name or email" }), {
    target: { value },
  });
}

describe("CheckInLookup", () => {
  it("lists no one until the admin searches", () => {
    render(
      <CheckInLookup attendees={[attendee(1)]} onPick={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("Pick someone to check them in."));
  });

  it("finds people by email and hands back the one picked", () => {
    const onPick = vi.fn();
    const people = [attendee(1), attendee(2)];
    render(<CheckInLookup attendees={people} onPick={onPick} onCancel={vi.fn()} />);

    search("student2@");
    fireEvent.click(screen.getByRole("button", { name: /Student 2/ }));

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(onPick).toHaveBeenCalledWith(people[1]);
  });

  it("says so when no one matches", () => {
    render(
      <CheckInLookup attendees={[attendee(1)]} onPick={vi.fn()} onCancel={vi.fn()} />
    );

    search("turing");

    expect(screen.getByText("No one matches"));
  });

  it("shows the first 20 matches and asks for more typing past that", () => {
    const people = Array.from({ length: 25 }, (_, index) => attendee(index));
    render(<CheckInLookup attendees={people} onPick={vi.fn()} onCancel={vi.fn()} />);

    search("student");

    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByText(/Showing 20 of 25/));
  });

  it("goes back to scanning", () => {
    const onCancel = vi.fn();
    render(<CheckInLookup attendees={[]} onPick={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to scanning" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
