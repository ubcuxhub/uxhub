import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";

import type { PurchaseRow, UserInfoRow } from "@/lib/supabase/models";
import type { CheckoutRequestInput } from "./types";

vi.mock("server-only", () => ({}));

const afterMocks = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => ({ after: afterMocks.after }));

const adminDb = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: adminDb }));

const squareMocks = vi.hoisted(() => ({
  create: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  get: vi.fn(),
  getRefund: vi.fn(),
}));
vi.mock("@/lib/square/client", () => ({
  squareClient: {
    payments: {
      create: squareMocks.create,
      complete: squareMocks.complete,
      cancel: squareMocks.cancel,
      get: squareMocks.get,
    },
    refunds: {
      get: squareMocks.getRefund,
    },
  },
  getSquareLocationId: () => "location-1",
  SQUARE_CURRENCY: "CAD",
}));

const eventsMocks = vi.hoisted(() => ({ fetchEventBySlug: vi.fn(), fetchEventById: vi.fn() }));
vi.mock("@/lib/supabase-helpers/events", () => ({
  fetchEventBySlug: eventsMocks.fetchEventBySlug,
  fetchEventById: eventsMocks.fetchEventById,
}));

// Reserving and releasing stay real so the RPCs they call are asserted.
const ticketsMocks = vi.hoisted(() => ({
  initializeEventCheckout: vi.fn(),
  fetchEventTicketByPurchaseId: vi.fn(),
  fetchUserEventTicket: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/event-tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase-helpers/event-tickets")>()),
  ...ticketsMocks,
}));

const membershipsMocks = vi.hoisted(() => ({
  fetchMembershipTypeBySlug: vi.fn(),
  fetchMembershipTypeById: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/memberships", () => membershipsMocks);

const purchasesMocks = vi.hoisted(() => ({
  createPurchase: vi.fn(),
  fetchLiveMembershipPurchase: vi.fn(),
  applySquarePaymentStatus: vi.fn(),
  failAbandonedPurchase: vi.fn(),
  markPurchaseFulfilled: vi.fn(),
  markSquareWebhookEventProcessed: vi.fn(),
  isUniqueViolation: (error: unknown) => (error as { code?: string } | null)?.code === "23505",
  fetchPurchaseById: vi.fn(),
  fetchPurchaseByIdempotencyKey: vi.fn(),
  fetchPurchaseBySquarePaymentId: vi.fn(),
  applyPurchaseRefund: vi.fn(),
  claimPurchaseRefundEmail: vi.fn(),
  releasePurchaseRefundEmailClaim: vi.fn(),
  markPurchaseRefundEmailSent: vi.fn(),
  forgetSquareWebhookEvent: vi.fn(),
  claimSquareWebhookEvent: vi.fn(),
  updatePurchase: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/purchases", () => purchasesMocks);

const grantMocks = vi.hoisted(() => ({ fulfillMembershipGrant: vi.fn() }));
vi.mock("@/lib/supabase-helpers/membership-history", () => grantMocks);

const usersMocks = vi.hoisted(() => ({
  fetchUserInfoContactById: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/users", () => usersMocks);

// The refund email runs for real on top of these, so its claim is exercised
// through the sync that schedules it.
const emailMocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: emailMocks.sendEmail,
  EmailSendError: class EmailSendError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  },
}));

const appSettingsMocks = vi.hoisted(() => ({
  fetchMembershipTermEndsAt: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/app-settings", () => appSettingsMocks);

const policyMocks = vi.hoisted(() => ({ isEligibleForMembership: vi.fn() }));
vi.mock("@/features/memberships/lib/policy", () => policyMocks);

const expiryMocks = vi.hoisted(() => ({ resolveMembershipExpiry: vi.fn() }));
vi.mock("@/features/memberships/lib/expiry", () => expiryMocks);

const customerMocks = vi.hoisted(() => ({ ensureSquareCustomerId: vi.fn() }));
vi.mock("./customer", () => customerMocks);

const confirmationEmailMocks = vi.hoisted(() => ({
  sendPurchaseConfirmationEmail: vi.fn(),
}));
vi.mock("./confirmation-email", () => confirmationEmailMocks);

const revalidationMocks = vi.hoisted(() => ({
  revalidatePurchasePaths: vi.fn(),
}));
vi.mock("./revalidation", () => revalidationMocks);

const logMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log")>()),
  log: logMocks,
}));

// fulfillment-rules is left real: it is what actually parses Square's error
// shape, and a mock here would hide the exact regression a Square SDK bump
// would introduce.

const { executeCheckoutForUser, processSquarePaymentEvent, processSquareRefundEvent } = await import(
  "./fulfillment"
);

function purchase(overrides: Partial<PurchaseRow> = {}): PurchaseRow {
  return {
    amount_cents: 2000,
    confirmation_email_attempted_at: null,
    confirmation_email_sent_at: null,
    created_at: null,
    currency: "CAD",
    event_id: null,
    failure_reason: null,
    fulfilled_at: null,
    id: "purchase-1",
    idempotency_key: "idem-1",
    kind: "event_ticket",
    membership_type_id: null,
    refunded_at: null,
    refunded_cents: 0,
    square_customer_id: null,
    square_payment_id: null,
    status: "pending",
    updated_at: null,
    user_id: "user-1",
    ...overrides,
  } as PurchaseRow;
}

const user = { id: "user-1", membership_type_id: null } as UserInfoRow;

function squareError(
  errors: { category: string; code: string; detail?: string }[]
) {
  return new SquareError({ message: "Request failed", body: { errors } });
}

const membershipInput: CheckoutRequestInput = {
  kind: "membership",
  slug: "annual-membership",
  token: "cnon:card-nonce-ok",
  idempotencyKey: "idem-1",
  expectedAmountCents: 2000,
};

const ticketInput: CheckoutRequestInput = {
  kind: "event_ticket",
  slug: "design-night",
  token: "cnon:card-nonce-ok",
  idempotencyKey: "idem-1",
  expectedAmountCents: 2000,
};

beforeEach(() => {
  vi.clearAllMocks();

  purchasesMocks.fetchPurchaseByIdempotencyKey.mockResolvedValue(null);
  purchasesMocks.fetchLiveMembershipPurchase.mockResolvedValue(null);
  purchasesMocks.createPurchase.mockImplementation(
    async (_db: unknown, payload: Partial<PurchaseRow>) =>
      purchase({ ...payload, id: "purchase-1" })
  );
  purchasesMocks.updatePurchase.mockImplementation(
    async (_db: unknown, id: string, payload: Partial<PurchaseRow>) =>
      purchase({ id, ...payload })
  );
  purchasesMocks.fetchPurchaseById.mockResolvedValue(purchase());
  purchasesMocks.claimSquareWebhookEvent.mockResolvedValue("claimed");
  purchasesMocks.markSquareWebhookEventProcessed.mockResolvedValue(undefined);
  purchasesMocks.applySquarePaymentStatus.mockImplementation(
    async (db: unknown, id: string, payment: { status: string; squarePaymentId: string | null; squareCustomerId: string | null }) => ({
      purchase: await purchasesMocks.updatePurchase(db, id, {
        status: payment.status,
        square_payment_id: payment.squarePaymentId,
        ...(payment.squareCustomerId ? { square_customer_id: payment.squareCustomerId } : {}),
      }),
      applied: true,
    })
  );
  purchasesMocks.markPurchaseFulfilled.mockImplementation(
    async (db: unknown, id: string) => purchasesMocks.updatePurchase(db, id, { fulfilled_at: "2026-11-24T00:00:00.000Z" })
  );
  purchasesMocks.forgetSquareWebhookEvent.mockResolvedValue(undefined);

  ticketsMocks.initializeEventCheckout.mockResolvedValue({ purchase_id: "purchase-1", amount_cents: 2000, failure_reason: null, created: true });
  ticketsMocks.fetchUserEventTicket.mockResolvedValue(null);
  ticketsMocks.fetchEventTicketByPurchaseId.mockResolvedValue({ id: "ticket-1" });

  customerMocks.ensureSquareCustomerId.mockResolvedValue("customer-1");
  appSettingsMocks.fetchMembershipTermEndsAt.mockResolvedValue(null);
  policyMocks.isEligibleForMembership.mockReturnValue(true);
  grantMocks.fulfillMembershipGrant.mockResolvedValue(purchase({ kind: "membership", status: "completed" }));
  expiryMocks.resolveMembershipExpiry.mockReturnValue("2027-06-01T00:00:00.000Z");
  revalidationMocks.revalidatePurchasePaths.mockResolvedValue(undefined);
  confirmationEmailMocks.sendPurchaseConfirmationEmail.mockResolvedValue(undefined);

  membershipsMocks.fetchMembershipTypeBySlug.mockResolvedValue({
    id: "membership-type-1",
    price: 20,
  });

  eventsMocks.fetchEventBySlug.mockResolvedValue({
    id: "event-1",
    member_price: 10,
    regular_price: 20,
    name: "Design Night",
  });

  adminDb.rpc.mockImplementation(async (fn: string) => {
    if (fn === "reserve_event_ticket") {
      return {
        data: [{ ticket_id: "ticket-1", failure_reason: null }],
        error: null,
      };
    }
    if (fn === "release_event_ticket") {
      return { data: null, error: null };
    }
    throw new Error(`Unexpected RPC: ${fn}`);
  });

  squareMocks.create.mockResolvedValue({
    payment: { id: "payment-1", customerId: "customer-1", status: "APPROVED" },
  });
  squareMocks.complete.mockResolvedValue({
    payment: { id: "payment-1", customerId: "customer-1", status: "COMPLETED" },
  });
  squareMocks.cancel.mockResolvedValue({});
});

describe("event ticket checkout", () => {
  it("fulfills a free registration without any Square customer or payment call", async () => {
    purchasesMocks.fetchPurchaseById.mockResolvedValue(purchase({ amount_cents: 0, status: "completed", fulfilled_at: "2026-11-11T00:00:00Z" }));
    const result = await executeCheckoutForUser(user, { ...ticketInput, token: null, expectedAmountCents: 0 });
    expect(result).toMatchObject({ ok: true, resolution: "completed", purchaseId: "purchase-1" });
    expect(customerMocks.ensureSquareCustomerId).not.toHaveBeenCalled();
    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(squareMocks.complete).not.toHaveBeenCalled();
    expect(revalidationMocks.revalidatePurchasePaths).toHaveBeenCalledWith(adminDb, "purchase-1");
    expect(afterMocks.after).toHaveBeenCalled();
  });

  it("rejects a stale free quote before any Square interaction", async () => {
    ticketsMocks.initializeEventCheckout.mockResolvedValue({ purchase_id: null, amount_cents: 2000, failure_reason: "PRICE_CHANGED" });
    const result = await executeCheckoutForUser(user, { ...ticketInput, token: null, expectedAmountCents: 0 });
    expect(result).toMatchObject({ ok: false, terminal: true, error: expect.stringContaining("price has changed") });
    expect(customerMocks.ensureSquareCustomerId).not.toHaveBeenCalled();
    expect(squareMocks.create).not.toHaveBeenCalled();
  });

  it("does not start a second external payment for a concurrently initialized paid attempt", async () => {
    ticketsMocks.initializeEventCheckout.mockResolvedValue({ purchase_id: "purchase-1", amount_cents: 2000, failure_reason: null, created: false });
    expect(await executeCheckoutForUser(user, ticketInput)).toMatchObject({ ok: true, resolution: "processing" });
    expect(customerMocks.ensureSquareCustomerId).not.toHaveBeenCalled();
    expect(squareMocks.create).not.toHaveBeenCalled();
  });

  it("reports a failed customer initialization without starting a payment", async () => {
    customerMocks.ensureSquareCustomerId.mockRejectedValue(new Error("Customer unavailable"));
    expect(await executeCheckoutForUser(user, ticketInput)).toMatchObject({ ok: false, terminal: true });
    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(purchasesMocks.updatePurchase).toHaveBeenCalledWith(adminDb, "purchase-1", expect.objectContaining({ status: "failed" }));
  });

  it("cancels the Square payment and marks the purchase canceled when the seat reservation fails", async () => {
    adminDb.rpc.mockImplementation(async (fn: string) => {
      if (fn === "reserve_event_ticket") {
        return {
          data: [{ ticket_id: null, failure_reason: "SOLD_OUT" }],
          error: null,
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    const result = await executeCheckoutForUser(user, ticketInput);

    expect(result).toEqual({
      ok: false,
      error: "This event is sold out.",
      terminal: true,
    });
    expect(squareMocks.cancel).toHaveBeenCalledWith({ paymentId: "payment-1" });
    expect(purchasesMocks.updatePurchase).toHaveBeenCalledWith(
      adminDb,
      "purchase-1",
      { failure_reason: "This event is sold out.", status: "canceled" }
    );
  });

  it("releases the seat and marks the purchase failed on a definitive decline", async () => {
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({ square_payment_id: "payment-1" })
    );
    squareMocks.complete.mockRejectedValue(
      squareError([{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }])
    );

    const result = await executeCheckoutForUser(user, ticketInput);

    expect(result).toEqual({
      ok: false,
      error:
        "Your bank declined this payment. Check your card details and try again, or use a different card.",
      terminal: true,
    });
    expect(squareMocks.cancel).toHaveBeenCalledWith({ paymentId: "payment-1" });
    expect(adminDb.rpc).toHaveBeenCalledWith(
      "release_event_ticket",
      { p_purchase_id: "purchase-1" }
    );
    expect(purchasesMocks.updatePurchase).toHaveBeenLastCalledWith(
      adminDb,
      "purchase-1",
      expect.objectContaining({ status: "failed" })
    );
    // A decline is expected, so it is a warning and never reaches Sentry.
    expect(logMocks.warn).toHaveBeenCalledWith("payment.ticket_charge_declined", {
      purchaseId: "purchase-1",
      diagnostic: "CARD_DECLINED (PAYMENT_METHOD_ERROR)",
    });
    expect(logMocks.error).not.toHaveBeenCalled();
  });

  it("leaves an ambiguous failure as processing without canceling or releasing the seat", async () => {
    squareMocks.complete.mockRejectedValue(
      squareError([{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }])
    );

    const result = await executeCheckoutForUser(user, ticketInput);

    expect(result).toEqual({
      ok: true,
      purchaseId: "purchase-1",
      resolution: "processing",
    });
    expect(squareMocks.cancel).not.toHaveBeenCalled();
    expect(adminDb.rpc).not.toHaveBeenCalledWith(
      "release_event_ticket",
      expect.anything()
    );
    // The money state is unclear, so this one alerts.
    expect(logMocks.error).toHaveBeenCalledWith("payment.ticket_charge_failed", {
      purchaseId: "purchase-1",
      diagnostic: "GATEWAY_TIMEOUT (API_ERROR)",
    });
  });

  it("asks Square to void the hold soon if it is never captured", async () => {
    await executeCheckoutForUser(user, ticketInput);

    expect(squareMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        autocomplete: false,
        delayAction: "CANCEL",
        delayDuration: "PT10M",
      })
    );
  });

  it("sells members only active events and lets staff register for drafts", async () => {
    await executeCheckoutForUser(user, ticketInput);
    expect(eventsMocks.fetchEventBySlug).toHaveBeenLastCalledWith(
      adminDb,
      ticketInput.slug,
      { status: "active" }
    );

    for (const role of ["admin", "manager"] as const) {
      await executeCheckoutForUser(
        { ...user, role_access: role } as UserInfoRow,
        { ...ticketInput, idempotencyKey: `key-${role}` }
      );
      expect(eventsMocks.fetchEventBySlug).toHaveBeenLastCalledWith(
        adminDb,
        ticketInput.slug,
        {}
      );
    }
  });

  it("refuses a second ticket before charging", async () => {
    ticketsMocks.fetchUserEventTicket.mockResolvedValue({ id: "ticket-1" });

    const result = await executeCheckoutForUser(user, ticketInput);

    expect(result).toEqual({
      ok: false,
      error: "You already have a ticket for this event.",
      terminal: true,
    });
    expect(squareMocks.create).not.toHaveBeenCalled();
  });

  it("charges the authoritative database amount rather than a stale user or client amount", async () => {
    purchasesMocks.fetchPurchaseById.mockResolvedValue(purchase({ amount_cents: 1000 }));
    await executeCheckoutForUser(
      { ...user, membership_type_id: "membership-type-1" } as UserInfoRow,
      ticketInput
    );

    expect(ticketsMocks.initializeEventCheckout).toHaveBeenCalledWith(
      adminDb, expect.objectContaining({ eventId: "event-1", userId: "user-1", freeOnly: false })
    );
    expect(squareMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMoney: { amount: BigInt(1000), currency: "CAD" },
      })
    );
  });
});

describe("idempotent retries", () => {
  it("reconciles an existing attempt instead of charging Square again", async () => {
    purchasesMocks.fetchPurchaseByIdempotencyKey.mockResolvedValue(
      purchase({
        kind: "membership",
        membership_type_id: "membership-type-1",
        square_payment_id: "payment-1",
        status: "pending",
      })
    );
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({
        kind: "membership",
        membership_type_id: "membership-type-1",
        square_customer_id: "customer-1",
      })
    );
    squareMocks.get.mockResolvedValue({
      payment: { id: "payment-1", status: "COMPLETED" },
    });

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(squareMocks.get).toHaveBeenCalledWith({ paymentId: "payment-1" });
    expect(result).toMatchObject({ ok: true, resolution: "completed" });
  });

  it("reuses a pending membership purchase for the same tier instead of charging again", async () => {
    purchasesMocks.fetchLiveMembershipPurchase.mockResolvedValue(
      purchase({
        kind: "membership",
        membership_type_id: "membership-type-1",
        square_payment_id: "payment-1",
        status: "pending",
      })
    );
    purchasesMocks.updatePurchase.mockImplementation(
      async (_db: unknown, id: string, payload: Partial<PurchaseRow>) =>
        purchase({ id, kind: "membership", membership_type_id: "membership-type-1", ...payload })
    );
    squareMocks.get.mockResolvedValue({
      payment: { id: "payment-1", status: "APPROVED" },
    });

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, resolution: "processing" });
  });

  it("refuses another tier while a membership payment is still processing", async () => {
    purchasesMocks.fetchLiveMembershipPurchase.mockResolvedValue(
      purchase({ kind: "membership", membership_type_id: "other-tier", square_payment_id: "payment-1", status: "pending" })
    );
    purchasesMocks.updatePurchase.mockImplementation(
      async (_db: unknown, id: string, payload: Partial<PurchaseRow>) =>
        purchase({ id, kind: "membership", membership_type_id: "other-tier", ...payload })
    );
    squareMocks.get.mockResolvedValue({ payment: { id: "payment-1", status: "PENDING" } });

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, terminal: true });
  });

  it("fails an abandoned pending attempt (no Square payment) and charges afresh", async () => {
    const stale = purchase({
      id: "stale-1",
      kind: "membership",
      membership_type_id: "membership-type-1",
      status: "pending",
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    purchasesMocks.fetchLiveMembershipPurchase.mockResolvedValue(stale);
    purchasesMocks.failAbandonedPurchase.mockResolvedValue({ ...stale, status: "failed" });

    await executeCheckoutForUser(user, membershipInput);

    expect(purchasesMocks.failAbandonedPurchase).toHaveBeenCalledWith(
      adminDb, "stale-1", expect.any(String), "This payment did not go through. Please try again."
    );
    expect(squareMocks.create).toHaveBeenCalledOnce();
  });

  it("leaves a recent pending attempt alone", async () => {
    purchasesMocks.fetchLiveMembershipPurchase.mockResolvedValue(
      purchase({ kind: "membership", membership_type_id: "membership-type-1", status: "pending", created_at: new Date().toISOString() })
    );

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(purchasesMocks.failAbandonedPurchase).not.toHaveBeenCalled();
    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, resolution: "processing" });
  });
});

describe("membership checkout guards", () => {
  it("refuses a price that changed since checkout loaded, before charging", async () => {
    const result = await executeCheckoutForUser(user, { ...membershipInput, expectedAmountCents: 1500 });

    expect(result).toMatchObject({ ok: false, terminal: true, error: expect.stringContaining("price has changed") });
    expect(purchasesMocks.createPurchase).not.toHaveBeenCalled();
    expect(squareMocks.create).not.toHaveBeenCalled();
  });

  it("refuses a request without the expected amount (an older client)", async () => {
    const { expectedAmountCents: _omitted, ...withoutAmount } = membershipInput;
    void _omitted;
    const result = await executeCheckoutForUser(user, withoutAmount);

    expect(result).toMatchObject({ ok: false, terminal: true });
    expect(squareMocks.create).not.toHaveBeenCalled();
  });

  it("grants a free tier as a completed purchase with no Square call", async () => {
    membershipsMocks.fetchMembershipTypeBySlug.mockResolvedValue({ id: "membership-type-1", price: 0 });
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({ kind: "membership", membership_type_id: "membership-type-1", amount_cents: 0, status: "completed" })
    );

    const result = await executeCheckoutForUser(user, { ...membershipInput, token: null, expectedAmountCents: 0 });

    expect(result).toMatchObject({ ok: true, resolution: "completed" });
    expect(purchasesMocks.createPurchase).toHaveBeenCalledWith(adminDb, expect.objectContaining({ amount_cents: 0, status: "completed" }));
    expect(customerMocks.ensureSquareCustomerId).not.toHaveBeenCalled();
    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(grantMocks.fulfillMembershipGrant).toHaveBeenCalled();
  });

  it("answers with the purchase that won when a concurrent checkout inserted first", async () => {
    purchasesMocks.createPurchase.mockRejectedValue({ code: "23505" });
    purchasesMocks.fetchLiveMembershipPurchase
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(purchase({ id: "winner", kind: "membership", membership_type_id: "membership-type-1", status: "pending" }));

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(result).toEqual({ ok: true, purchaseId: "winner", resolution: "processing" });
    expect(squareMocks.create).not.toHaveBeenCalled();
  });

  it("fails the attempt when Square refuses the request outright, so it blocks nothing", async () => {
    squareMocks.create.mockRejectedValue(
      new SquareError({ statusCode: 400, body: { errors: [{ category: "INVALID_REQUEST_ERROR", code: "INVALID_LOCATION" }] } })
    );

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(result).toMatchObject({ ok: false, terminal: true });
    expect(purchasesMocks.updatePurchase).toHaveBeenCalledWith(adminDb, "purchase-1", expect.objectContaining({ status: "failed" }));
  });

  it("keeps a timed-out request processing, since Square may have taken it", async () => {
    squareMocks.create.mockRejectedValue(
      new SquareError({ statusCode: 504, body: { errors: [{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }] } })
    );

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(result).toMatchObject({ ok: true, resolution: "processing" });
    expect(purchasesMocks.updatePurchase).not.toHaveBeenCalledWith(adminDb, "purchase-1", expect.objectContaining({ status: "failed" }));
  });
});

describe("membership fulfillment", () => {
  it("logs a declined membership charge as a warning, not an error", async () => {
    squareMocks.create.mockRejectedValue(
      squareError([{ category: "PAYMENT_METHOD_ERROR", code: "CVV_FAILURE" }])
    );

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(result).toMatchObject({ ok: false, terminal: true });
    expect(logMocks.warn).toHaveBeenCalledWith(
      "payment.membership_charge_declined",
      { purchaseId: "purchase-1", diagnostic: "CVV_FAILURE (PAYMENT_METHOD_ERROR)" }
    );
    expect(logMocks.error).not.toHaveBeenCalled();
  });

  it("stamps the expiry and clears the pre-order on a completed membership purchase", async () => {
    squareMocks.create.mockResolvedValue({
      payment: { id: "payment-1", customerId: "customer-1", status: "COMPLETED" },
    });
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({
        created_at: "2026-11-01T00:00:00.000Z",
        kind: "membership",
        membership_type_id: "membership-type-1",
        square_customer_id: "customer-1",
      })
    );

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(result).toMatchObject({ ok: true, resolution: "completed" });
    expect(grantMocks.fulfillMembershipGrant).toHaveBeenCalledWith(
      adminDb, "purchase-1", "2027-06-01T00:00:00.000Z",
    );
    expect(expiryMocks.resolveMembershipExpiry).toHaveBeenCalledWith(
      null, new Date("2026-11-01T00:00:00.000Z"),
    );
  });

  it("retries a failed atomic membership grant on a later webhook", async () => {
    squareMocks.create.mockResolvedValue({
      payment: { id: "payment-1", customerId: "customer-1", status: "COMPLETED" },
    });
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({ kind: "membership", membership_type_id: "membership-type-1" })
    );
    grantMocks.fulfillMembershipGrant.mockRejectedValueOnce(new Error("connection reset"));

    // The grant fails: the purchase must not be stamped, so a retry grants it.
    await executeCheckoutForUser(user, membershipInput);
    expect(grantMocks.fulfillMembershipGrant).toHaveBeenCalledTimes(1);
    expect(revalidationMocks.revalidatePurchasePaths).not.toHaveBeenCalled();
    expect(afterMocks.after).not.toHaveBeenCalled();
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(
      purchase({ kind: "membership", membership_type_id: "membership-type-1", square_payment_id: "payment-1" })
    );
    await processSquarePaymentEvent({
      eventId: "event-retry-2",
      type: "payment.updated",
      data: { object: { payment: { id: "payment-1", status: "COMPLETED" } } },
    } as never);

    expect(grantMocks.fulfillMembershipGrant).toHaveBeenCalledTimes(2);
    expect(grantMocks.fulfillMembershipGrant).toHaveBeenLastCalledWith(
      adminDb, "purchase-1", "2027-06-01T00:00:00.000Z",
    );
    expect(purchasesMocks.markPurchaseFulfilled).not.toHaveBeenCalled();
    expect(revalidationMocks.revalidatePurchasePaths).toHaveBeenCalledWith(adminDb, "purchase-1");
  });

  it("does not re-fulfill an already-fulfilled purchase", async () => {
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({
        kind: "membership",
        membership_type_id: "membership-type-1",
        fulfilled_at: "2026-01-01T00:00:00.000Z",
      })
    );
    squareMocks.create.mockResolvedValue({
      payment: { id: "payment-1", customerId: "customer-1", status: "COMPLETED" },
    });

    await executeCheckoutForUser(user, membershipInput);

    expect(grantMocks.fulfillMembershipGrant).not.toHaveBeenCalled();
    // Still scheduled, so a send that failed on an earlier pass gets retried.
    expect(afterMocks.after).toHaveBeenCalled();
  });
});

describe("webhook-driven reconciliation", () => {
  const event = {
    eventId: "event-1",
    type: "payment.updated" as const,
    data: { object: { payment: { id: "payment-1", status: "COMPLETED" } } },
  };

  it("finds the purchase by referenceId when the payment ID was never persisted", async () => {
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(null);
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({ event_id: "event-1", square_payment_id: null })
    );

    await processSquarePaymentEvent({
      ...event,
      data: {
        object: {
          payment: {
            id: "payment-1",
            status: "COMPLETED",
            referenceId: "purchase-1",
            amountMoney: { amount: BigInt(2000), currency: "CAD" },
          },
        },
      },
    });

    expect(purchasesMocks.updatePurchase).toHaveBeenCalledWith(
      adminDb,
      "purchase-1",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("releases the seat when Square voids an uncaptured ticket hold", async () => {
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(
      purchase({ event_id: "event-1", square_payment_id: "payment-1", status: "authorized" })
    );

    await processSquarePaymentEvent({
      ...event,
      data: { object: { payment: { id: "payment-1", status: "CANCELED" } } },
    });

    expect(purchasesMocks.updatePurchase).toHaveBeenCalledWith(
      adminDb,
      "purchase-1",
      expect.objectContaining({ status: "canceled" })
    );
    expect(adminDb.rpc).toHaveBeenCalledWith(
      "release_event_ticket",
      { p_purchase_id: "purchase-1" }
    );
  });

  it("leaves seats alone when a membership payment is canceled", async () => {
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(
      purchase({ kind: "membership", square_payment_id: "payment-1" })
    );
    purchasesMocks.updatePurchase.mockImplementation(
      async (_db: unknown, id: string, payload: Partial<PurchaseRow>) =>
        purchase({ id, kind: "membership", ...payload })
    );

    await processSquarePaymentEvent({
      ...event,
      data: { object: { payment: { id: "payment-1", status: "CANCELED" } } },
    });

    expect(adminDb.rpc).not.toHaveBeenCalled();
  });

  it("forgets the event when processing fails so Square's retry is processed", async () => {
    const failure = new Error("database unavailable");
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockRejectedValue(failure);

    await expect(processSquarePaymentEvent(event)).rejects.toBe(failure);

    expect(purchasesMocks.forgetSquareWebhookEvent).toHaveBeenCalledWith(
      adminDb,
      "event-1"
    );
  });

  it("still reports the processing failure when forgetting the event fails", async () => {
    const failure = new Error("database unavailable");
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockRejectedValue(failure);
    purchasesMocks.forgetSquareWebhookEvent.mockRejectedValue(
      new Error("delete failed")
    );

    await expect(processSquarePaymentEvent(event)).rejects.toBe(failure);
  });

  it("keeps the event recorded when processing succeeds", async () => {
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(
      purchase({ event_id: "event-1", square_payment_id: "payment-1" })
    );
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({ event_id: "event-1", square_payment_id: "payment-1" })
    );

    await processSquarePaymentEvent(event);

    expect(purchasesMocks.forgetSquareWebhookEvent).not.toHaveBeenCalled();
  });

  it("does nothing on a duplicate webhook delivery", async () => {
    purchasesMocks.claimSquareWebhookEvent.mockResolvedValue("processed");

    await processSquarePaymentEvent(event);

    expect(purchasesMocks.fetchPurchaseBySquarePaymentId).not.toHaveBeenCalled();
    expect(purchasesMocks.updatePurchase).not.toHaveBeenCalled();
  });
});

describe("refund webhooks", () => {
  const refundEvent = {
    eventId: "refund-event-1",
    type: "refund.updated",
    data: {
      object: { refund: { id: "refund-1", paymentId: "payment-1", status: "COMPLETED", amountMoney: { amount: BigInt(2000), currency: "CAD" as const } } },
    },
  };
  const refundResult = {
    refundedCents: 2000,
    fullyRefunded: true,
    amountIncreased: true,
    ticketRemoved: true,
    keptCheckedInTicket: false,
  };

  function refundedPayment(refundIds: string[], refunded = 2000) {
    return {
      payment: {
        id: "payment-1",
        status: "COMPLETED",
        amountMoney: { amount: BigInt(2000), currency: "CAD" },
        refundedMoney: { amount: BigInt(refunded), currency: "CAD" },
        refundIds,
      },
    };
  }

  function refund(id: string, status: string, amount: number) {
    return { refund: { id, status, amountMoney: { amount: BigInt(amount), currency: "CAD" } } };
  }

  beforeEach(() => {
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(
      purchase({ event_id: "event-1", square_payment_id: "payment-1", status: "completed" })
    );
    purchasesMocks.applyPurchaseRefund.mockResolvedValue(refundResult);
    squareMocks.get.mockResolvedValue(refundedPayment(["refund-1"]));
    squareMocks.getRefund.mockResolvedValue(refund("refund-1", "COMPLETED", 2000));
  });

  it("records the completed refunds fetched from Square", async () => {
    await processSquareRefundEvent(refundEvent);

    expect(squareMocks.get).toHaveBeenCalledWith({ paymentId: "payment-1" });
    expect(purchasesMocks.applyPurchaseRefund).toHaveBeenCalledWith(adminDb, "purchase-1", 2000);
    expect(logMocks.info).toHaveBeenCalledWith(
      "payment.refund_recorded",
      expect.objectContaining({ purchaseId: "purchase-1", ticketRemoved: true })
    );
    expect(revalidationMocks.revalidatePurchasePaths).toHaveBeenCalledWith(adminDb, "purchase-1");
  });

  it("records nothing for a refund that is still pending", async () => {
    squareMocks.getRefund.mockResolvedValue(refund("refund-1", "PENDING", 2000));

    await processSquareRefundEvent(refundEvent);

    expect(purchasesMocks.applyPurchaseRefund).not.toHaveBeenCalled();
  });

  it("counts only the completed part when one refund of two is pending", async () => {
    squareMocks.get.mockResolvedValue(refundedPayment(["refund-1", "refund-2"]));
    squareMocks.getRefund.mockImplementation(async ({ refundId }: { refundId: string }) =>
      refundId === "refund-1" ? refund("refund-1", "COMPLETED", 500) : refund("refund-2", "PENDING", 1500)
    );

    await processSquareRefundEvent(refundEvent);

    expect(purchasesMocks.applyPurchaseRefund).toHaveBeenCalledWith(adminDb, "purchase-1", 500);
  });

  it("warns when a full refund lands after check-in", async () => {
    purchasesMocks.applyPurchaseRefund.mockResolvedValue({
      ...refundResult,
      ticketRemoved: false,
      keptCheckedInTicket: true,
    });

    await processSquareRefundEvent(refundEvent);

    expect(logMocks.warn).toHaveBeenCalledWith(
      "payment.refund_after_check_in",
      expect.objectContaining({ purchaseId: "purchase-1" })
    );
    expect(logMocks.error).not.toHaveBeenCalled();
  });

  it("warns and keeps the membership when a membership is refunded", async () => {
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(
      purchase({ kind: "membership", square_payment_id: "payment-1", status: "completed" })
    );
    purchasesMocks.applyPurchaseRefund.mockResolvedValue({ ...refundResult, ticketRemoved: false });

    await processSquareRefundEvent(refundEvent);

    expect(logMocks.warn).toHaveBeenCalledWith(
      "payment.membership_refunded",
      expect.objectContaining({ purchaseId: "purchase-1" })
    );
    expect(grantMocks.fulfillMembershipGrant).not.toHaveBeenCalled();
  });

  it("does nothing on a duplicate delivery", async () => {
    purchasesMocks.claimSquareWebhookEvent.mockResolvedValue("processed");

    await processSquareRefundEvent(refundEvent);

    expect(squareMocks.get).not.toHaveBeenCalled();
    expect(purchasesMocks.applyPurchaseRefund).not.toHaveBeenCalled();
  });

  it("forgets the event when Square can't be reached, so the retry runs", async () => {
    const failure = new Error("Square unavailable");
    squareMocks.get.mockRejectedValue(failure);

    await expect(processSquareRefundEvent(refundEvent)).rejects.toBe(failure);

    expect(purchasesMocks.forgetSquareWebhookEvent).toHaveBeenCalledWith(adminDb, "refund-event-1");
  });

  it("also syncs refunds from a payment.updated that lists them", async () => {
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({ event_id: "event-1", status: "completed", fulfilled_at: "2026-11-01T00:00:00Z" })
    );

    await processSquarePaymentEvent({
      eventId: "event-2",
      type: "payment.updated",
      data: { object: { payment: refundedPayment(["refund-1"]).payment as never } },
    });

    expect(purchasesMocks.applyPurchaseRefund).toHaveBeenCalledWith(adminDb, "purchase-1", 2000);
  });

  it("never reserves a ticket for a purchase refunded before fulfillment", async () => {
    const refunded = purchase({
      event_id: "event-1",
      square_payment_id: "payment-1",
      status: "authorized",
      refunded_cents: 2000,
    });
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(refunded);
    purchasesMocks.fetchPurchaseById.mockResolvedValue({ ...refunded, status: "completed" });
    purchasesMocks.updatePurchase.mockImplementation(
      async (_db: unknown, id: string, payload: Partial<PurchaseRow>) =>
        purchase({ ...refunded, id, ...payload })
    );
    ticketsMocks.fetchEventTicketByPurchaseId.mockResolvedValue(null);

    await processSquarePaymentEvent({
      eventId: "event-3",
      type: "payment.updated",
      data: { object: { payment: { id: "payment-1", status: "COMPLETED" } } },
    });

    expect(adminDb.rpc).not.toHaveBeenCalledWith("reserve_event_ticket", expect.anything());
    expect(logMocks.warn).toHaveBeenCalledWith("payment.refunded_before_fulfillment", { purchaseId: "purchase-1" });
    expect(afterMocks.after).not.toHaveBeenCalled();
  });
});

describe("refund emails", () => {
  const ticketPurchase = purchase({
    event_id: "event-1",
    square_payment_id: "payment-1",
    status: "completed",
    fulfilled_at: "2026-11-01T00:00:00Z",
  });

  function refundEvent(eventId: string) {
    return {
      eventId,
      type: "refund.updated",
      data: {
        object: {
          refund: {
            id: "refund-1",
            paymentId: "payment-1",
            amountMoney: { amount: BigInt(2000), currency: "CAD" as const },
          },
        },
      },
    };
  }

  function payment(refundIds: string[], refunded: number) {
    return {
      payment: {
        id: "payment-1",
        status: "COMPLETED",
        amountMoney: { amount: BigInt(2000), currency: "CAD" },
        refundedMoney: { amount: BigInt(refunded), currency: "CAD" },
        refundIds,
      },
    };
  }

  const squareRefunds = new Map<string, { status: string; amount: number }>();

  /**
   * The claim as the database keeps it: one row per refund, claimed when no
   * one has, released after a send that didn't happen, then marked sent.
   */
  const claims = new Map<string, { attempted: boolean; sent: boolean }>();

  /** Runs what the sync scheduled with `after`, as Next does after the response. */
  async function runAfter() {
    const callbacks = afterMocks.after.mock.calls.map(([callback]) => callback as () => Promise<void>);
    afterMocks.after.mockClear();
    await Promise.all(callbacks.map((callback) => callback()));
  }

  beforeEach(() => {
    squareRefunds.clear();
    claims.clear();
    squareRefunds.set("refund-1", { status: "COMPLETED", amount: 2000 });

    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(ticketPurchase);
    purchasesMocks.fetchPurchaseById.mockResolvedValue({ ...ticketPurchase, refunded_cents: 2000 });
    purchasesMocks.applyPurchaseRefund.mockResolvedValue({
      refundedCents: 2000,
      fullyRefunded: true,
      amountIncreased: true,
      ticketRemoved: true,
      keptCheckedInTicket: false,
    });
    squareMocks.get.mockResolvedValue(payment(["refund-1"], 2000));
    squareMocks.getRefund.mockImplementation(async ({ refundId }: { refundId: string }) => {
      const refund = squareRefunds.get(refundId)!;
      return {
        refund: {
          id: refundId,
          status: refund.status,
          amountMoney: { amount: BigInt(refund.amount), currency: "CAD" },
        },
      };
    });
    ticketsMocks.fetchEventTicketByPurchaseId.mockResolvedValue(null);
    eventsMocks.fetchEventById.mockResolvedValue({ id: "event-1", name: "Design Night" });
    usersMocks.fetchUserInfoContactById.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
    });
    emailMocks.sendEmail.mockResolvedValue(true);

    purchasesMocks.claimPurchaseRefundEmail.mockImplementation(
      async (_db: unknown, input: { squareRefundId: string }) => {
        // Yield first, so concurrent passes interleave before the check.
        await Promise.resolve();
        const row = claims.get(input.squareRefundId) ?? { attempted: false, sent: false };
        claims.set(input.squareRefundId, row);
        if (row.attempted || row.sent) return false;
        row.attempted = true;
        return true;
      }
    );
    purchasesMocks.releasePurchaseRefundEmailClaim.mockImplementation(
      async (_db: unknown, refundId: string) => {
        const row = claims.get(refundId);
        if (row && !row.sent) row.attempted = false;
      }
    );
    purchasesMocks.markPurchaseRefundEmailSent.mockImplementation(
      async (_db: unknown, refundId: string) => {
        claims.get(refundId)!.sent = true;
      }
    );
  });

  it("emails the buyer once a refund completes, with the site's purchase link", async () => {
    await processSquareRefundEvent(refundEvent("e-1"), "https://www.site.example");
    await runAfter();

    expect(emailMocks.sendEmail).toHaveBeenCalledOnce();
    const [{ to, subject, html }] = emailMocks.sendEmail.mock.calls[0];
    expect(to).toBe("ada@example.com");
    expect(subject).toBe("Your refund for Design Night");
    expect(html).toContain("is no longer valid");
    expect(html).toContain("https://www.site.example/portal#settings/purchases");
    expect(purchasesMocks.claimPurchaseRefundEmail).toHaveBeenCalledWith(adminDb, {
      squareRefundId: "refund-1",
      purchaseId: "purchase-1",
      amountCents: 2000,
      currency: "CAD",
    });
    expect(purchasesMocks.markPurchaseRefundEmailSent).toHaveBeenCalledWith(adminDb, "refund-1");
  });

  it("sends once across repeated deliveries of the same refund", async () => {
    await processSquareRefundEvent(refundEvent("e-1"));
    await runAfter();
    // The amount is already recorded now, as the database would report.
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue({ ...ticketPurchase, refunded_cents: 2000 });
    await processSquareRefundEvent(refundEvent("e-2"));
    await processSquarePaymentEvent({
      eventId: "e-3",
      type: "payment.updated",
      data: { object: { payment: payment(["refund-1"], 2000).payment as never } },
    });
    await runAfter();

    expect(emailMocks.sendEmail).toHaveBeenCalledOnce();
  });

  it("sends once when deliveries of the same refund run concurrently", async () => {
    await Promise.all([
      processSquareRefundEvent(refundEvent("e-1")),
      processSquareRefundEvent(refundEvent("e-2")),
      processSquareRefundEvent(refundEvent("e-3")),
    ]);
    await runAfter();

    expect(emailMocks.sendEmail).toHaveBeenCalledOnce();
  });

  it("sends one email per refund when a purchase takes two partial refunds", async () => {
    squareRefunds.set("refund-1", { status: "COMPLETED", amount: 500 });
    squareMocks.get.mockResolvedValue(payment(["refund-1"], 500));
    purchasesMocks.applyPurchaseRefund.mockResolvedValue({
      refundedCents: 500,
      fullyRefunded: false,
      amountIncreased: true,
      ticketRemoved: false,
      keptCheckedInTicket: false,
    });
    ticketsMocks.fetchEventTicketByPurchaseId.mockResolvedValue({ id: "ticket-1" });
    purchasesMocks.fetchPurchaseById.mockResolvedValue({ ...ticketPurchase, refunded_cents: 500 });

    await processSquareRefundEvent(refundEvent("e-1"));
    await runAfter();

    squareRefunds.set("refund-2", { status: "COMPLETED", amount: 700 });
    squareMocks.get.mockResolvedValue(payment(["refund-1", "refund-2"], 1200));
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue({ ...ticketPurchase, refunded_cents: 500 });
    purchasesMocks.fetchPurchaseById.mockResolvedValue({ ...ticketPurchase, refunded_cents: 1200 });

    await processSquareRefundEvent(refundEvent("e-2"));
    await runAfter();

    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(2);
    const [first, second] = emailMocks.sendEmail.mock.calls.map(([email]) => email.html as string);
    expect(first).toContain("$5.00 CAD");
    expect(first).not.toContain("no longer valid");
    expect(second).toContain("$7.00 CAD");
    expect(second).toContain("$12.00 CAD of $20.00 CAD");
  });

  it.each(["PENDING", "FAILED", "REJECTED"])("sends nothing for a %s refund", async (status) => {
    squareRefunds.set("refund-1", { status, amount: 2000 });
    squareMocks.get.mockResolvedValue(payment(["refund-1"], 0));

    await processSquareRefundEvent(refundEvent("e-1"));
    await runAfter();

    expect(purchasesMocks.claimPurchaseRefundEmail).not.toHaveBeenCalled();
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("waits while Square's refunded total lags its refund list", async () => {
    squareMocks.get.mockResolvedValue(payment(["refund-1"], 0));

    await processSquareRefundEvent(refundEvent("e-1"));
    await runAfter();

    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("says nothing about a refund that completed long ago", async () => {
    squareMocks.getRefund.mockResolvedValue({
      refund: {
        id: "refund-1",
        status: "COMPLETED",
        amountMoney: { amount: BigInt(2000), currency: "CAD" },
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });

    await processSquareRefundEvent(refundEvent("e-1"));
    await runAfter();

    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the send throws, and a later delivery retries it", async () => {
    emailMocks.sendEmail.mockRejectedValueOnce(new Error("Resend is down"));

    await expect(processSquareRefundEvent(refundEvent("e-1"))).resolves.toBeUndefined();
    await expect(runAfter()).resolves.toBeUndefined();

    expect(purchasesMocks.applyPurchaseRefund).toHaveBeenCalled();
    expect(purchasesMocks.forgetSquareWebhookEvent).not.toHaveBeenCalled();
    expect(logMocks.warn).toHaveBeenCalledWith(
      "payment.refund_email_failed",
      expect.objectContaining({ purchaseId: "purchase-1" })
    );
    expect(logMocks.error).not.toHaveBeenCalled();
    expect(purchasesMocks.releasePurchaseRefundEmailClaim).toHaveBeenCalledWith(adminDb, "refund-1");

    await processSquareRefundEvent(refundEvent("e-2"));
    await runAfter();

    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(purchasesMocks.markPurchaseRefundEmailSent).toHaveBeenCalledOnce();
  });

  it("emails about a membership refund too", async () => {
    const membership = purchase({
      kind: "membership",
      membership_type_id: "type-1",
      square_payment_id: "payment-1",
      status: "completed",
    });
    purchasesMocks.fetchPurchaseBySquarePaymentId.mockResolvedValue(membership);
    purchasesMocks.fetchPurchaseById.mockResolvedValue({ ...membership, refunded_cents: 2000 });
    membershipsMocks.fetchMembershipTypeById.mockResolvedValue({ id: "type-1", name: "Student" });

    await processSquareRefundEvent(refundEvent("e-1"));
    await runAfter();

    expect(emailMocks.sendEmail).toHaveBeenCalledOnce();
    expect(emailMocks.sendEmail.mock.calls[0][0].subject).toBe("Your refund for Student");
    expect(emailMocks.sendEmail.mock.calls[0][0].html).not.toContain("ticket");
  });
});
