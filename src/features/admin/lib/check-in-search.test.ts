import { describe, expect, it } from "vitest";

import type { CheckInAttendee } from "@/features/admin/types";

import { searchCheckInAttendees } from "./check-in-search";

const ada: CheckInAttendee = {
  id: "ticket-1",
  user_id: "user-1",
  user_name: "Ada Lovelace",
  user_email: "ada@student.ubc.ca",
};
const grace: CheckInAttendee = {
  id: "ticket-2",
  user_id: "user-2",
  user_name: "Grace Hopper",
  user_email: "grace@example.com",
};
const attendees = [ada, grace];

describe("searchCheckInAttendees", () => {
  it("finds someone by part of their name, ignoring case", () => {
    expect(searchCheckInAttendees(attendees, "lovel")).toEqual([ada]);
    expect(searchCheckInAttendees(attendees, "GRACE")).toEqual([grace]);
  });

  it("finds someone by email", () => {
    expect(searchCheckInAttendees(attendees, "student.ubc")).toEqual([ada]);
  });

  it("ignores spaces around the query", () => {
    expect(searchCheckInAttendees(attendees, "  hopper ")).toEqual([grace]);
  });

  it("returns everyone for an empty query", () => {
    expect(searchCheckInAttendees(attendees, "   ")).toEqual(attendees);
  });

  it("returns no one when nothing matches", () => {
    expect(searchCheckInAttendees(attendees, "turing")).toEqual([]);
  });
});
