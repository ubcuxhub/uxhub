import { describe, expect, it } from "vitest";

import {
  formatRefundAmount,
  purchaseHistoryUrl,
  renderRefundIssuedEmail,
  type RefundIssuedEmailInput,
} from "./refund-templates";

function input(overrides: Partial<RefundIssuedEmailInput> = {}): RefundIssuedEmailInput {
  return {
    kind: "event_ticket",
    itemName: "Design Sprint",
    userName: "Ada Lovelace",
    refundCents: 2500,
    paidCents: 2500,
    totalRefundedCents: 2500,
    currency: "CAD",
    ticketNoLongerValid: true,
    purchasesUrl: purchaseHistoryUrl("https://www.site.example"),
    orderId: "purchase-1",
    ...overrides,
  };
}

/** The visible text, for asserting copy without the markup around it. */
function text(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

describe("formatRefundAmount", () => {
  it("formats like the receipts and spells out the currency", () => {
    expect(formatRefundAmount(1250, "CAD")).toBe("$12.50 CAD");
    expect(formatRefundAmount(100000, "USD")).toBe("$1,000.00 USD");
  });
});

describe("renderRefundIssuedEmail", () => {
  it("tells a ticket holder about a full refund and that the ticket is no longer valid", () => {
    const { subject, html } = renderRefundIssuedEmail(input());
    const body = text(html);

    expect(subject).toBe("Your refund for Design Sprint");
    expect(body).toContain("Hi Ada Lovelace, we’ve refunded your ticket for Design Sprint in full.");
    expect(body).toContain("Amount refunded $25.00 CAD");
    expect(body).toContain("Refund Full refund");
    expect(body).not.toContain("Refunded so far");
    expect(body).toContain("Your ticket for Design Sprint is no longer valid.");
    expect(body).toContain("Refunds usually take 5–10 business days to appear, depending on your bank.");
    expect(body).toContain("Order ID purchase-1");
  });

  it("says a partial refund is partial, with the running total, and keeps the ticket valid", () => {
    const { html } = renderRefundIssuedEmail(
      input({ refundCents: 1000, totalRefundedCents: 1500, ticketNoLongerValid: false })
    );
    const body = text(html);

    expect(body).toContain("we’ve refunded part of what you paid for your ticket for Design Sprint.");
    expect(body).toContain("Amount refunded $10.00 CAD");
    expect(body).toContain("Refund Partial refund");
    expect(body).toContain("Refunded so far $15.00 CAD of $25.00 CAD");
    expect(body).not.toContain("no longer valid");
  });

  it("covers a membership, without any ticket wording", () => {
    const { subject, html } = renderRefundIssuedEmail(
      input({ kind: "membership", itemName: "Student", ticketNoLongerValid: true })
    );
    const body = text(html);

    expect(subject).toBe("Your refund for Student");
    expect(body).toContain("we’ve refunded your Student membership in full.");
    expect(body).toContain("Membership Student");
    expect(body).not.toContain("ticket");
  });

  it("covers a partial membership refund", () => {
    const { html } = renderRefundIssuedEmail(
      input({ kind: "membership", itemName: "Student", refundCents: 500, totalRefundedCents: 500 })
    );

    expect(text(html)).toContain("we’ve refunded part of what you paid for your Student membership.");
    expect(text(html)).toContain("Refunded so far $5.00 CAD of $25.00 CAD");
  });

  it("links to the purchase history, and leaves the button out without a site", () => {
    expect(renderRefundIssuedEmail(input()).html).toContain(
      'href="https://www.site.example/portal#settings/purchases"'
    );
    expect(renderRefundIssuedEmail(input()).html).toContain("View your purchases");

    const withoutLink = renderRefundIssuedEmail(input({ purchasesUrl: null })).html;
    expect(withoutLink).not.toContain("View your purchases");
    expect(withoutLink).not.toContain("href=");
  });

  it("greets by name, or generically when there is none", () => {
    expect(text(renderRefundIssuedEmail(input({ userName: "  " })).html)).toContain("Hi there, ");
  });

  it("escapes names everywhere they appear in the body", () => {
    const { subject, html } = renderRefundIssuedEmail(
      input({ itemName: `<script>alert("x")</script> & Co`, userName: "<b>Eve</b>" })
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Eve</b>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co");
    expect(html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    // The subject is plain text, not HTML.
    expect(subject).toBe(`Your refund for <script>alert("x")</script> & Co`);
  });

  it("never mentions staff, card numbers or Square", () => {
    const body = text(renderRefundIssuedEmail(input()).html).toLowerCase();
    expect(body).not.toContain("staff");
    expect(body).not.toContain("square");
    expect(body).not.toContain("card");
  });
});
