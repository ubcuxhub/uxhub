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
}));
vi.mock("@/lib/square/client", () => ({
  squareClient: {
    payments: {
      create: squareMocks.create,
      complete: squareMocks.complete,
      cancel: squareMocks.cancel,
      get: squareMocks.get,
    },
  },
  getSquareLocationId: () => "location-1",
  SQUARE_CURRENCY: "CAD",
}));

const eventsMocks = vi.hoisted(() => ({ fetchEventBySlug: vi.fn() }));
vi.mock("@/lib/supabase-helpers/events", () => ({
  fetchEventBySlug: eventsMocks.fetchEventBySlug,
}));

const applicationsMocks = vi.hoisted(() => ({
  fetchApplicationQuestions: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/event-applications", () => ({
  fetchApplicationQuestions: applicationsMocks.fetchApplicationQuestions,
}));

const registrationsMocks = vi.hoisted(() => ({
  fetchEventRegistrationByPurchaseId: vi.fn(),
  fetchUserRegistration: vi.fn(),
  updateEventRegistration: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/event-registrations", () => registrationsMocks);

const membershipsMocks = vi.hoisted(() => ({
  fetchMembershipTypeBySlug: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/memberships", () => membershipsMocks);

const purchasesMocks = vi.hoisted(() => ({
  createPurchase: vi.fn(),
  fetchNonterminalMembershipPurchase: vi.fn(),
  fetchPurchaseById: vi.fn(),
  fetchPurchaseByIdempotencyKey: vi.fn(),
  fetchPurchaseBySquarePaymentId: vi.fn(),
  recordSquareWebhookEvent: vi.fn(),
  updatePurchase: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/purchases", () => purchasesMocks);

const usersMocks = vi.hoisted(() => ({ updateUserInfoById: vi.fn() }));
vi.mock("@/lib/supabase-helpers/users", () => usersMocks);

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

// fulfillment-rules is left real: it is what actually parses Square's error
// shape, and a mock here would hide the exact regression a Square SDK bump
// would introduce.

const { executeCheckoutForUser, processSquarePaymentEvent } = await import(
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
  buyerFirstName: "Jamie",
  buyerLastName: "Lee",
  buyerEmail: "jamie@example.com",
};

const ticketInput: CheckoutRequestInput = {
  kind: "event_ticket",
  slug: "design-night",
  token: "cnon:card-nonce-ok",
  idempotencyKey: "idem-1",
  buyerFirstName: "Jamie",
  buyerLastName: "Lee",
  buyerEmail: "jamie@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();

  purchasesMocks.fetchPurchaseByIdempotencyKey.mockResolvedValue(null);
  purchasesMocks.fetchNonterminalMembershipPurchase.mockResolvedValue(null);
  purchasesMocks.createPurchase.mockImplementation(
    async (_db: unknown, payload: Partial<PurchaseRow>) =>
      purchase({ ...payload, id: "purchase-1" })
  );
  purchasesMocks.updatePurchase.mockImplementation(
    async (_db: unknown, id: string, payload: Partial<PurchaseRow>) =>
      purchase({ id, ...payload })
  );
  purchasesMocks.fetchPurchaseById.mockResolvedValue(purchase());
  purchasesMocks.recordSquareWebhookEvent.mockResolvedValue(true);

  registrationsMocks.fetchUserRegistration.mockResolvedValue(null);
  registrationsMocks.fetchEventRegistrationByPurchaseId.mockResolvedValue({
    id: "registration-1",
  });
  applicationsMocks.fetchApplicationQuestions.mockResolvedValue([]);

  customerMocks.ensureSquareCustomerId.mockResolvedValue("customer-1");
  appSettingsMocks.fetchMembershipTermEndsAt.mockResolvedValue(null);
  policyMocks.isEligibleForMembership.mockReturnValue(true);
  expiryMocks.resolveMembershipExpiry.mockReturnValue("2027-06-01T00:00:00.000Z");
  revalidationMocks.revalidatePurchasePaths.mockResolvedValue(undefined);
  confirmationEmailMocks.sendPurchaseConfirmationEmail.mockResolvedValue(undefined);

  membershipsMocks.fetchMembershipTypeBySlug.mockResolvedValue({
    id: "membership-type-1",
    price: 20,
  });

  eventsMocks.fetchEventBySlug.mockResolvedValue({
    id: "event-1",
    applications_enabled: false,
    member_price: 10,
    regular_price: 20,
    name: "Design Night",
  });

  adminDb.rpc.mockImplementation(async (fn: string) => {
    if (fn === "reserve_paid_event_ticket") {
      return {
        data: [{ registration_id: "registration-1", failure_reason: null }],
        error: null,
      };
    }
    if (fn === "release_paid_event_ticket_reservation") {
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
  it("cancels the Square payment and marks the purchase canceled when the seat reservation fails", async () => {
    adminDb.rpc.mockImplementation(async (fn: string) => {
      if (fn === "reserve_paid_event_ticket") {
        return {
          data: [{ registration_id: null, failure_reason: "SOLD_OUT" }],
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
      "release_paid_event_ticket_reservation",
      { p_purchase_id: "purchase-1" }
    );
    expect(purchasesMocks.updatePurchase).toHaveBeenLastCalledWith(
      adminDb,
      "purchase-1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("leaves an ambiguous failure as processing without canceling or releasing the seat", async () => {
    squareMocks.complete.mockRejectedValue(
      squareError([{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }])
    );

    const result = await executeCheckoutForUser(user, ticketInput);

    expect(result).toEqual({
      ok: true,
      purchaseId: "purchase-1",
      redirectTo: "/portal#settings/purchases",
      resolution: "processing",
    });
    expect(squareMocks.cancel).not.toHaveBeenCalled();
    expect(adminDb.rpc).not.toHaveBeenCalledWith(
      "release_paid_event_ticket_reservation",
      expect.anything()
    );
  });

  it("charges members the member price", async () => {
    await executeCheckoutForUser(
      { ...user, membership_type_id: "membership-type-1" } as UserInfoRow,
      ticketInput
    );

    expect(purchasesMocks.createPurchase).toHaveBeenCalledWith(
      adminDb,
      expect.objectContaining({ amount_cents: 1000 })
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
    purchasesMocks.fetchNonterminalMembershipPurchase.mockResolvedValue(
      purchase({
        kind: "membership",
        membership_type_id: "membership-type-1",
        square_payment_id: "payment-1",
        status: "pending",
      })
    );
    squareMocks.get.mockResolvedValue({
      payment: { id: "payment-1", status: "APPROVED" },
    });

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(squareMocks.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, resolution: "processing" });
  });
});

describe("membership fulfillment", () => {
  it("stamps the expiry and clears the pre-order on a completed membership purchase", async () => {
    squareMocks.create.mockResolvedValue({
      payment: { id: "payment-1", customerId: "customer-1", status: "COMPLETED" },
    });
    purchasesMocks.fetchPurchaseById.mockResolvedValue(
      purchase({
        kind: "membership",
        membership_type_id: "membership-type-1",
        square_customer_id: "customer-1",
      })
    );

    const result = await executeCheckoutForUser(user, membershipInput);

    expect(result).toMatchObject({ ok: true, resolution: "completed" });
    expect(usersMocks.updateUserInfoById).toHaveBeenCalledWith(
      adminDb,
      "user-1",
      {
        membership_expires_at: "2027-06-01T00:00:00.000Z",
        membership_pre_ordered_type_id: null,
        membership_type_id: "membership-type-1",
        square_customer_id: "customer-1",
      }
    );
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

    expect(usersMocks.updateUserInfoById).not.toHaveBeenCalled();
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

  it("does nothing on a duplicate webhook delivery", async () => {
    purchasesMocks.recordSquareWebhookEvent.mockResolvedValue(false);

    await processSquarePaymentEvent(event);

    expect(purchasesMocks.fetchPurchaseBySquarePaymentId).not.toHaveBeenCalled();
    expect(purchasesMocks.updatePurchase).not.toHaveBeenCalled();
  });
});
