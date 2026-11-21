import { describe, expect, it } from "vitest";

import {
  formatReminderWhen,
  formatReminderWhere,
  renderEventReminderEmail,
  type EventReminderEmailInput,
} from "./reminder-templates";

const base: EventReminderEmailInput = {
  kind: "1d",
  firstName: "Priya",
  eventName: "Design Jam",
  eventUrl: "https://www.ubcuxhub.ca/portal/events/design-jam",
  // 6:00 PM to 9:00 PM Pacific (permanent UTC-7) on Friday, November 27, 2026.
  startsAt: "2026-11-28T01:00:00Z",
  endsAt: "2026-11-28T04:00:00Z",
  location: { type: "in_person", restricted: false, building: "Orchard Commons", room: "1001", address: "6363 Agronomy Rd" },
};

const buttons = (html: string) => html.match(/<a href=/g)?.length ?? 0;

describe("formatReminderWhen", () => {
  it("names the Pacific day and time range", () => {
    expect(formatReminderWhen(base.startsAt, base.endsAt)).toBe("Fri, Nov 27, 6:00 PM–9:00 PM Pacific time");
  });

  it("shows only the first day of a multi-day event", () => {
    expect(formatReminderWhen(base.startsAt, "2026-11-30T01:00:00Z")).toBe("Fri, Nov 27, 6:00 PM Pacific time");
  });
});

describe("formatReminderWhere", () => {
  it("joins the building and room like the receipt, with the address apart", () => {
    expect(formatReminderWhere(base.location)).toEqual({ where: "Orchard Commons 1001", address: "6363 Agronomy Rd" });
  });

  it("says online for an online event, and both for a hybrid one", () => {
    expect(formatReminderWhere({ type: "online", restricted: false, meeting_url: "https://meet.example.test" }))
      .toEqual({ where: "Online", address: null });
    expect(formatReminderWhere({ type: "hybrid", restricted: false, building: "IKB" }))
      .toEqual({ where: "IKB, or online", address: null });
  });

  it("leaves the location out when there is none", () => {
    expect(formatReminderWhere(null)).toEqual({ where: null, address: null });
    expect(formatReminderWhere({ type: "in_person", restricted: false })).toEqual({ where: null, address: null });
  });
});

describe("renderEventReminderEmail", () => {
  it("reminds a day before with the details and one ticket button", () => {
    const { subject, html } = renderEventReminderEmail(base);
    expect(subject).toBe("See you tomorrow at Design Jam");
    expect(html).toContain(">See you tomorrow at Design Jam</h1>");
    expect(html).toContain("Hi Priya, a quick reminder that Design Jam is tomorrow.");
    expect(html).toContain("Fri, Nov 27, 6:00 PM–9:00 PM Pacific time");
    expect(html).toContain("Orchard Commons 1001");
    expect(html).toContain("6363 Agronomy Rd");
    expect(html).toContain("UX Hub exec");
    expect(html).not.toMatch(/staff/i);
    expect(html).toContain(`<a href="${base.eventUrl}"`);
    expect(html).toContain(">View your ticket</a>");
    expect(buttons(html)).toBe(1);
  });

  it("says the event starts soon two hours before", () => {
    const { subject, html } = renderEventReminderEmail({ ...base, kind: "2h" });
    expect(subject).toBe("Design Jam starts soon");
    expect(html).toContain("Hi Priya, Design Jam starts in about two hours.");
    expect(buttons(html)).toBe(1);
  });

  it("greets without a name and skips missing details", () => {
    const { html } = renderEventReminderEmail({ ...base, firstName: " ", location: null });
    expect(html).toContain("Hi there,");
    expect(html).not.toContain(">Where<");
    expect(html).not.toContain(">Address<");
  });

  it("escapes the event name, the location and the URL", () => {
    const { html } = renderEventReminderEmail({
      ...base,
      eventName: "<b>Jam</b>",
      eventUrl: "https://www.ubcuxhub.ca/portal/events/a%22b?x=1&y=2",
      location: { type: "in_person", restricted: false, building: "<script>", room: "" },
    });
    expect(html).not.toContain("<b>Jam</b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Jam&lt;/b&gt;");
    expect(html).toContain('href="https://www.ubcuxhub.ca/portal/events/a%22b?x=1&amp;y=2"');
  });
});
