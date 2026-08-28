import { describe, expect, it } from "vitest";
import {
  renderEventConfirmationEmail,
  renderMembershipConfirmationEmail,
} from "./templates";

const purchase = {
  amount_cents: 1500,
  created_at: "2026-08-01T00:00:00Z",
  id: "purchase-1",
};

const event = {
  end_time: "20:00",
  location_address_url: null,
  location_building: "Buchanan",
  location_room: "A101",
  name: "Portfolio Night",
  start_date: "2026-09-12",
  start_time: "18:00",
};

describe("renderEventConfirmationEmail", () => {
  it("includes the event name, date, time range, location, and amount", () => {
    const { html, subject } = renderEventConfirmationEmail({
      event,
      purchase,
      userName: "Ada",
    });

    expect(subject).toContain("Portfolio Night");
    expect(html).toContain("September 12, 2026");
    expect(html).toContain("6:00 p.m. – 8:00 p.m.");
    expect(html).toContain("Buchanan A101");
    expect(html).toContain("$15.00");
  });

  it("drops optional fields instead of leaking null or undefined", () => {
    const { html } = renderEventConfirmationEmail({
      event: {
        ...event,
        end_time: null,
        location_building: null,
        location_room: null,
      },
      purchase,
      userName: "Ada",
    });

    expect(html).not.toContain("null");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("Location");
    expect(html).toContain("6:00 p.m.");
    expect(html).not.toContain("–");
  });

  it("escapes HTML in event-supplied text", () => {
    const { html } = renderEventConfirmationEmail({
      event: { ...event, location_room: "<script>alert(1)</script>" },
      purchase,
      userName: "Ada",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderMembershipConfirmationEmail", () => {
  it("includes the membership name and amount", () => {
    const { html, subject } = renderMembershipConfirmationEmail({
      membershipType: { name: "Innovator" },
      purchase,
      userName: "Ada",
    });

    expect(subject).toContain("Innovator");
    expect(html).toContain("Innovator");
    expect(html).toContain("$15.00");
  });
});
