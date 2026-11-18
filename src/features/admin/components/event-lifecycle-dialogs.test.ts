import { describe, expect, it, vi } from "vitest";

// The dialogs import their server actions; only the copy helpers run here.
vi.mock("../event-overview-actions", () => ({}));

import { refundReminder } from "./CancelEventDialog";
import { unpublishConsequence, unpublishRefusal } from "./EventUnpublishDialog";

describe("revert dialog copy", () => {
  it("says how many are registered, and to cancel instead", () => {
    expect(unpublishRefusal(1)).toBe("1 person is registered. Cancel the event instead.");
    expect(unpublishRefusal(3)).toBe("3 people are registered. Cancel the event instead.");
  });

  it("counts the member applications that lose access", () => {
    expect(unpublishConsequence(0)).toBe("Members won’t see this event until you publish it again.");
    expect(unpublishConsequence(2)).toContain(
      "2 member applications (submitted, waitlisted or draft) will lose access until you publish it again."
    );
    expect(unpublishConsequence(1)).toContain("1 member application (");
  });
});

describe("cancel dialog copy", () => {
  it("counts the paid tickets to refund in Square", () => {
    expect(refundReminder(null)).toBe("Checking paid tickets…");
    expect(refundReminder(0)).toBe("No paid tickets need a refund.");
    expect(refundReminder(1)).toMatch(/^1 paid ticket needs a refund\. Issue refunds in Square/);
    expect(refundReminder(4)).toMatch(/^4 paid tickets need a refund\./);
  });
});
