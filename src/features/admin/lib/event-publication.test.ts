import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/supabase/models";
import {
  assertPublishAt,
  eventScheduleProblem,
  FINISH_IN_EDIT,
  isPublishing,
  publicationReadinessProblem,
  publishAtProblem,
} from "./event-publication";

const NOW = Date.parse("2026-11-05T20:00:00.000Z");
const FUTURE = "2026-11-06T20:00:00.000Z";
const PAST = "2026-11-04T20:00:00.000Z";

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Portfolio Night",
    short_description: "Show your work.",
    description: "A night of portfolio reviews.",
    status: "draft",
    publish_at: null,
    event_type: "regular",
    regular_price: 10,
    member_price: 5,
    max_capacity: 40,
    starts_at: "2026-11-20T02:00:00.000Z",
    ends_at: "2026-11-20T04:00:00.000Z",
    registration_opens_at: null,
    registration_closes_at: null,
    location_building: null,
    location_room: null,
    location_address_url: null,
    image_url: null,
    description_images: [],
    configured_marketing_mode: null,
    configured_marketing_url: null,
    configured_price: null,
    configured_pricing_mode: null,
    configured_slug: null,
    configured_slug_edited: false,
    description_rich: null,
    first_published_at: null,
    pricing_policy: "legacy",
    agenda: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: null,
    mentors_enabled: false,
    sponsors_enabled: false,
    requires_application: false,
    slug: "portfolio-night",
    agenda_enabled: false,
    event_colour: null,
    header_colour: null,
    header_image_url: null,
    is_featured: false,
    location_address: null,
    location_type: "in_person",
    marketing_url: null,
    max_team_size: null,
    min_team_size: null,
    team_deadline: null,
    teams_enabled: false,
    ...overrides,
  };
}

describe("publishAtProblem", () => {
  it("accepts no publish date for any status", () => {
    expect(publishAtProblem("active", null, NOW)).toBeNull();
    expect(publishAtProblem("draft", undefined, NOW)).toBeNull();
  });

  it("accepts a future timestamp on a draft", () => {
    expect(publishAtProblem("draft", FUTURE, NOW)).toBeNull();
  });

  it.each(["invalid", "2027-08-01T18:00", "", 42])(
    "rejects %s as not a timestamp with a timezone",
    (value) => {
      expect(publishAtProblem("draft", value, NOW)).toBe(
        "Publish date must be a valid timestamp with a timezone."
      );
    }
  );

  it("rejects a publish date on an active event", () => {
    expect(publishAtProblem("active", FUTURE, NOW)).toBe(
      "Only draft events can have a publish date."
    );
  });

  it("rejects a publish date in the past", () => {
    expect(publishAtProblem("draft", PAST, NOW)).toBe(
      "Publish date must be in the future."
    );
  });

  it("throws the same message from assertPublishAt", () => {
    expect(() => assertPublishAt("draft", PAST, NOW)).toThrow(
      "Publish date must be in the future."
    );
    expect(() => assertPublishAt("draft", FUTURE, NOW)).not.toThrow();
  });
});

describe("isPublishing", () => {
  it("is a draft turned active", () => {
    expect(isPublishing({ status: "draft" }, { status: "active", publish_at: null })).toBe(true);
  });

  it("is a draft given (or keeping) a publish date", () => {
    expect(isPublishing({ status: "draft" }, { status: "draft", publish_at: FUTURE })).toBe(true);
  });

  it("isn't a draft staying a draft, or an event already active", () => {
    expect(isPublishing({ status: "draft" }, { status: "draft", publish_at: null })).toBe(false);
    expect(isPublishing({ status: "active" }, { status: "active", publish_at: null })).toBe(false);
  });
});

describe("publicationReadinessProblem", () => {
  const ready = { checkInSessions: [], applicationQuestions: [] };

  it("passes an event the builder would save", () => {
    expect(publicationReadinessProblem({ ...ready, event: event() })).toBeNull();
  });

  it("names the first required field that's missing", () => {
    expect(
      publicationReadinessProblem({ ...ready, event: event({ short_description: null }) })
    ).toBe(`${FINISH_IN_EDIT} Short description is required.`);
    expect(
      publicationReadinessProblem({ ...ready, event: event({ ends_at: null }) })
    ).toBe(`${FINISH_IN_EDIT} Event start and end dates and times are required.`);
  });

  it("checks the stored check-in sessions and application questions", () => {
    expect(
      publicationReadinessProblem({
        event: event(),
        checkInSessions: [{ name: "", start_time: "2026-11-20T02:00:00.000Z", end_time: "2026-11-20T03:00:00.000Z" }],
        applicationQuestions: [],
      })
    ).toBe(`${FINISH_IN_EDIT} All check-in sessions require name, start time, and end time.`);

    expect(
      publicationReadinessProblem({
        event: event({ requires_application: true }),
        checkInSessions: [],
        applicationQuestions: [
          {
            id: "q1",
            event_id: "e1",
            question: " ",
            description: null,
            response_type: "short_text",
            is_required: true,
            sort_order: 0,
            max_char_limit: 500,
            response_options: null,
            restrict_file_types: false,
            allowed_file_types: null,
            max_file_size_bytes: null,
          } as never,
        ],
      })
    ).toBe(`${FINISH_IN_EDIT} Please fix the errors in application questions.`);
  });

  it("ignores a stored publish date (its own rule checks it against the clock)", () => {
    expect(
      publicationReadinessProblem({ ...ready, event: event({ publish_at: PAST }) })
    ).toBeNull();
  });
});

describe("eventScheduleProblem", () => {
  const valid = {
    status: "draft",
    publish_at: null,
    starts_at: "2026-11-20T02:00:00.000Z",
    ends_at: "2026-11-20T04:00:00.000Z",
    registration_opens_at: null,
    registration_closes_at: null,
  } as const;

  it("accepts a complete schedule", () => {
    expect(eventScheduleProblem(valid, NOW)).toBeNull();
    expect(
      eventScheduleProblem(
        {
          ...valid,
          publish_at: FUTURE,
          registration_opens_at: "2026-11-10T02:00:00.000Z",
          registration_closes_at: "2026-11-19T02:00:00.000Z",
        },
        NOW
      )
    ).toBeNull();
  });

  it("rejects an unknown status", () => {
    expect(eventScheduleProblem({ ...valid, status: "archived" as never }, NOW)).toBe(
      "Choose whether the event is a draft or active."
    );
  });

  it("rejects a date that isn't a timestamp", () => {
    expect(eventScheduleProblem({ ...valid, ends_at: "2026-11-20T04:00" }, NOW)).toBe(
      "Dates must be valid timestamps with a timezone."
    );
  });

  it("requires a start and end, in order", () => {
    expect(eventScheduleProblem({ ...valid, starts_at: null }, NOW)).toBe(
      "Event start and end dates and times are required."
    );
    expect(eventScheduleProblem({ ...valid, ends_at: valid.starts_at }, NOW)).toBe(
      "Event end time must be after the start time."
    );
  });

  it("requires registration to close after it opens", () => {
    expect(
      eventScheduleProblem(
        {
          ...valid,
          registration_opens_at: "2026-11-19T02:00:00.000Z",
          registration_closes_at: "2026-11-10T02:00:00.000Z",
        },
        NOW
      )
    ).toBe("Registration end time must be after the start time.");
  });

  it("applies the publish date rules", () => {
    expect(eventScheduleProblem({ ...valid, status: "active", publish_at: FUTURE }, NOW)).toBe(
      "Only draft events can have a publish date."
    );
    expect(eventScheduleProblem({ ...valid, publish_at: PAST }, NOW)).toBe(
      "Publish date must be in the future."
    );
  });
});
