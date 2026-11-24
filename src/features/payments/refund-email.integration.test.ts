/**
 * The refund email's claim against the local database: one email per Square
 * refund however many passes see it, and the table out of members' reach.
 * Sending is mocked; the claim, its release and the sent mark are real.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimPurchaseRefundEmail,
  markPurchaseRefundEmailSent,
  releasePurchaseRefundEmailClaim,
} from "@/lib/supabase-helpers/purchases";
import { TABLES } from "@/lib/supabase-helpers/tables";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));

const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: email.sendEmail,
  EmailSendError: class EmailSendError extends Error {},
}));

const { sendRefundIssuedEmail } = await import("./refund-email");

const db = createIntegrationClient();

beforeEach(() => {
  email.sendEmail.mockReset();
  email.sendEmail.mockResolvedValue(true);
});

async function refundedMembership(fixtures: Fixtures) {
  const tier = await fixtures.createMembershipType({ name: `Refund tier ${fixtures.tag}` });
  const buyer = await fixtures.createUser();
  const { data, error } = await db
    .from(TABLES.purchases)
    .insert({
      user_id: buyer.id,
      kind: "membership",
      membership_type_id: tier.id,
      status: "completed",
      amount_cents: 2000,
      currency: "CAD",
      idempotency_key: `it-${randomUUID()}`,
      refunded_cents: 2000,
      refunded_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return { buyer, purchase: data, tier };
}

async function refundEmailRow(squareRefundId: string) {
  const { data, error } = await db
    .from(TABLES.purchaseRefundEmails)
    .select("*")
    .eq("square_refund_id", squareRefundId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

describe("refund email claim", () => {
  it("lets one claim win, hands it back after a failed send, and never after a sent one", () =>
    withFixtures(async (fixtures) => {
      const { purchase } = await refundedMembership(fixtures);
      const input = {
        squareRefundId: `it-refund-${randomUUID()}`,
        purchaseId: purchase.id,
        amountCents: 2000,
        currency: "CAD",
      };

      expect(await claimPurchaseRefundEmail(db, input)).toBe(true);
      expect(await claimPurchaseRefundEmail(db, input)).toBe(false);

      await releasePurchaseRefundEmailClaim(db, input.squareRefundId);
      expect(await claimPurchaseRefundEmail(db, input)).toBe(true);

      await markPurchaseRefundEmailSent(db, input.squareRefundId);
      await releasePurchaseRefundEmailClaim(db, input.squareRefundId);
      expect(await claimPurchaseRefundEmail(db, input)).toBe(false);

      const row = await refundEmailRow(input.squareRefundId);
      expect(row).toMatchObject({ purchase_id: purchase.id, amount_cents: 2000, currency: "CAD" });
      expect(row?.email_attempted_at).not.toBeNull();
      expect(row?.email_sent_at).not.toBeNull();
    }));

  it("lets exactly one of many concurrent claims win", () =>
    withFixtures(async (fixtures) => {
      const { purchase } = await refundedMembership(fixtures);
      const input = {
        squareRefundId: `it-refund-${randomUUID()}`,
        purchaseId: purchase.id,
        amountCents: 2000,
        currency: "CAD",
      };

      const results = await Promise.all(
        Array.from({ length: 8 }, () => claimPurchaseRefundEmail(db, input))
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    }));

  it("sends once per refund across repeated and concurrent passes", () =>
    withFixtures(async (fixtures) => {
      const { purchase, tier, buyer } = await refundedMembership(fixtures);
      const first = { id: `it-refund-${randomUUID()}`, amountCents: 500, currency: "CAD" };
      const second = { id: `it-refund-${randomUUID()}`, amountCents: 1500, currency: "CAD" };

      await Promise.all([
        sendRefundIssuedEmail(db, purchase.id, first, "https://www.site.example"),
        sendRefundIssuedEmail(db, purchase.id, first, "https://www.site.example"),
        sendRefundIssuedEmail(db, purchase.id, second, "https://www.site.example"),
        sendRefundIssuedEmail(db, purchase.id, second, "https://www.site.example"),
      ]);
      await sendRefundIssuedEmail(db, purchase.id, first, "https://www.site.example");
      await sendRefundIssuedEmail(db, purchase.id, second, "https://www.site.example");

      expect(email.sendEmail).toHaveBeenCalledTimes(2);
      for (const [message] of email.sendEmail.mock.calls) {
        expect(message.to).toBe(buyer.email);
        expect(message.subject).toBe(`Your refund for ${tier.name}`);
      }
      expect((await refundEmailRow(first.id))?.email_sent_at).not.toBeNull();
      expect((await refundEmailRow(second.id))?.email_sent_at).not.toBeNull();
    }));

  it("releases the claim when the send throws, so the next pass sends", () =>
    withFixtures(async (fixtures) => {
      const { purchase } = await refundedMembership(fixtures);
      const refund = { id: `it-refund-${randomUUID()}`, amountCents: 2000, currency: "CAD" };
      email.sendEmail.mockRejectedValueOnce(new Error("Resend is down"));

      await expect(sendRefundIssuedEmail(db, purchase.id, refund, null)).resolves.toBeUndefined();
      expect(await refundEmailRow(refund.id)).toMatchObject({
        email_attempted_at: null,
        email_sent_at: null,
      });

      await sendRefundIssuedEmail(db, purchase.id, refund, null);
      expect(email.sendEmail).toHaveBeenCalledTimes(2);
      expect((await refundEmailRow(refund.id))?.email_sent_at).not.toBeNull();
    }));

  it("is out of reach of members, the buyer included", () =>
    withFixtures(async (fixtures) => {
      const { purchase, buyer } = await refundedMembership(fixtures);
      const squareRefundId = `it-refund-${randomUUID()}`;
      await claimPurchaseRefundEmail(db, {
        squareRefundId,
        purchaseId: purchase.id,
        amountCents: 2000,
        currency: "CAD",
      });

      for (const client of [clientAs(buyer), clientAs(null)]) {
        const read = await client.from(TABLES.purchaseRefundEmails).select("*");
        expect(read.error ?? read.data).toSatisfy(
          (result: unknown) => !Array.isArray(result) || result.length === 0
        );
        const write = await client.from(TABLES.purchaseRefundEmails).insert({
          square_refund_id: `it-refund-${randomUUID()}`,
          purchase_id: purchase.id,
          amount_cents: 1,
          currency: "CAD",
        });
        expect(write.error).not.toBeNull();
      }
    }));

  it("goes with its purchase", () =>
    withFixtures(async (fixtures) => {
      const { purchase } = await refundedMembership(fixtures);
      const squareRefundId = `it-refund-${randomUUID()}`;
      await claimPurchaseRefundEmail(db, {
        squareRefundId,
        purchaseId: purchase.id,
        amountCents: 2000,
        currency: "CAD",
      });

      const { error } = await db.from(TABLES.purchases).delete().eq("id", purchase.id);
      if (error) throw error;

      expect(await refundEmailRow(squareRefundId)).toBeNull();
    }));
});
