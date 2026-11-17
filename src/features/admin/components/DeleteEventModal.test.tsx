import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/actions", () => ({ loadAdminEventDeletionInfoAction: vi.fn() }));

import { deletionSummary } from "./DeleteEventModal";

describe("deletionSummary", () => {
  it("names everything the delete takes, drafts counted with applications", () => {
    expect(
      deletionSummary("UXathon", { applications: 12, drafts: 3, reviewerNotes: 4, registered: 2, teams: 1 })
    ).toBe(
      "This permanently deletes UXathon: 15 applications with their answers and uploaded files, 4 reviewer notes, 2 registrations and 1 team. Applicants aren’t notified. This can’t be undone."
    );
  });

  it("uses the singular for one", () => {
    expect(
      deletionSummary("Mixer", { applications: 1, drafts: 0, reviewerNotes: 1, registered: 1, teams: 0 })
    ).toBe(
      "This permanently deletes Mixer: 1 application with their answers and uploaded files, 1 reviewer note, 1 registration and 0 teams. Applicants aren’t notified. This can’t be undone."
    );
  });
});
