import { describe, expect, it } from "vitest";

import {
  formatOfferDeadline,
  portalApplicationUrl,
  portalEventUrl,
  renderApplicationEmail,
} from "./application-templates";

const base = {
  firstName: "Priya",
  eventName: "UXathon 2027",
  eventUrl: "https://www.ubcuxhub.ca/portal/events/uxathon-2027",
  // 11:45 PM Pacific (permanent UTC-7) on Wednesday, November 25, 2026.
  offerExpiresAt: "2026-11-26T06:45:00Z",
};

describe("formatOfferDeadline", () => {
  it("names the Pacific date and time", () => {
    expect(formatOfferDeadline(base.offerExpiresAt)).toBe(
      "Wed, Nov 25, 2026 at 11:45 PM Pacific time"
    );
  });
});

describe("portalEventUrl", () => {
  it("encodes the slug", () => {
    expect(portalEventUrl("https://www.ubcuxhub.ca", "a b\"<c>")).toBe(
      "https://www.ubcuxhub.ca/portal/events/a%20b%22%3Cc%3E"
    );
  });
});

describe("portalApplicationUrl", () => {
  it("is the event's apply page, with the slug encoded", () => {
    expect(portalApplicationUrl("https://www.ubcuxhub.ca", "a/b")).toBe(
      "https://www.ubcuxhub.ca/portal/events/a%2Fb/apply"
    );
  });
});

describe("renderApplicationEmail", () => {
  it("tells an accepted applicant to confirm by the deadline", () => {
    const { subject, html } = renderApplicationEmail({ ...base, kind: "accepted" });
    expect(subject).toBe("You’re in: UXathon 2027");
    expect(html).toContain("Hi Priya, congratulations!");
    expect(html).toContain("Confirm your spot in the portal by Wed, Nov 25, 2026 at 11:45 PM Pacific time.");
    expect(html).toContain(`href="${base.eventUrl}"`);
    expect(html).toContain(">Confirm your spot</a>");
  });

  it("tells a waitlisted applicant a spot shows in the portal", () => {
    const { subject, html } = renderApplicationEmail({ ...base, kind: "waitlisted", offerExpiresAt: null });
    expect(subject).toBe("You’re on the waitlist for UXathon 2027");
    expect(html).toContain("If a spot opens up, it’ll show on the event page in the portal.");
    expect(html).toContain(`href="${base.eventUrl}"`);
    // No promise of a later email.
    expect(html).not.toMatch(/email you|we’ll let you know/i);
  });

  it("lets a rejected applicant down kindly, without a deadline or button", () => {
    const { subject, html } = renderApplicationEmail({ ...base, kind: "rejected", offerExpiresAt: null });
    expect(subject).toBe("Your application to UXathon 2027");
    expect(html).toContain("We weren’t able to offer you a spot this time.");
    expect(html).not.toContain("<a ");
  });

  it("reminds an accepted applicant before the deadline", () => {
    const { subject, html } = renderApplicationEmail({ ...base, kind: "offer_reminder" });
    expect(subject).toBe("Reminder: confirm your spot at UXathon 2027");
    expect(html).toContain("runs out in less than a day");
    expect(html).toContain("by Wed, Nov 25, 2026 at 11:45 PM Pacific time.");
    expect(html).toContain(`href="${base.eventUrl}"`);
  });

  it("escapes names and falls back when the first name is blank", () => {
    const { html } = renderApplicationEmail({
      ...base,
      kind: "accepted",
      firstName: " ",
      eventName: "<script>alert(1)</script>",
    });
    expect(html).toContain("Hi there,");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  describe("received", () => {
    const received = {
      ...base,
      kind: "received" as const,
      eventUrl: "https://www.ubcuxhub.ca/portal/events/uxathon-2027/apply",
      offerExpiresAt: null,
    };

    it("thanks the applicant and names the release date", () => {
      const { subject, html } = renderApplicationEmail({
        ...received,
        decisionsReleaseAt: base.offerExpiresAt,
      });
      expect(subject).toBe("We received your application to UXathon 2027");
      expect(html).toContain("Hi Priya, thanks for applying to UXathon 2027. We’ve received your application.");
      expect(html).toContain("UX Hub execs will review it, and you’ll hear from us by Wed, Nov 25, 2026.");
      expect(html).toContain("You can’t edit your answers now that you’ve submitted");
      expect(html).toContain(`href="${received.eventUrl}"`);
      expect(html).toContain(">View your application</a>");
      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html).not.toMatch(/staff/i);
    });

    it("promises no date when none is set", () => {
      for (const decisionsReleaseAt of [null, undefined]) {
        const { html } = renderApplicationEmail({ ...received, decisionsReleaseAt });
        expect(html).toContain("UX Hub execs will review it and let you know.");
        expect(html).not.toContain("hear from us by");
        expect(html).toContain(">View your application</a>");
      }
    });

    it("escapes the event name in the subject's HTML and the body", () => {
      const { subject, html } = renderApplicationEmail({
        ...received,
        eventName: `<b>"Jam" & 'Co'</b>`,
      });
      // The subject is plain text, not HTML.
      expect(subject).toBe(`We received your application to <b>"Jam" & 'Co'</b>`);
      expect(html).not.toContain("<b>");
      expect(html).toContain("&lt;b&gt;&quot;Jam&quot; &amp; &#39;Co&#39;&lt;/b&gt;");
    });
  });

  it("escapes the button URL", () => {
    const { html } = renderApplicationEmail({
      ...base,
      kind: "accepted",
      eventUrl: 'https://x.test/" onclick="x',
    });
    expect(html).toContain('href="https://x.test/&quot; onclick=&quot;x"');
  });
});
