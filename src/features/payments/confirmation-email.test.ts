import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendEmail = vi.fn();
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const fetchPurchaseById = vi.fn();
const claimPurchaseConfirmationEmail = vi.fn();
const updatePurchase = vi.fn();
vi.mock("@/lib/supabase-helpers/purchases", () => ({
  claimPurchaseConfirmationEmail: (...args: unknown[]) =>
    claimPurchaseConfirmationEmail(...args),
  fetchPurchaseById: (...args: unknown[]) => fetchPurchaseById(...args),
  updatePurchase: (...args: unknown[]) => updatePurchase(...args),
}));

vi.mock("@/lib/supabase-helpers/users", () => ({
  fetchUserInfoContactById: async () => ({
    email: "ada@example.com",
    id: "user-1",
    name: "Ada",
  }),
}));

vi.mock("@/lib/supabase-helpers/memberships", () => ({
  fetchMembershipTypeById: async () => ({ name: "Innovator" }),
}));

vi.mock("@/lib/supabase-helpers/events", () => ({
  fetchEventById: async () => ({ name: "Portfolio Night" }),
}));

const { sendPurchaseConfirmationEmail } = await import("./confirmation-email");

const adminDb = {} as never;

const completedMembershipPurchase = {
  amount_cents: 1500,
  confirmation_email_attempted_at: null,
  confirmation_email_sent_at: null,
  created_at: "2026-08-01T00:00:00Z",
  currency: "CAD",
  id: "purchase-1",
  kind: "membership",
  membership_type_id: "membership-1",
  status: "completed",
  user_id: "user-1",
};

describe("sendPurchaseConfirmationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(true);
    claimPurchaseConfirmationEmail.mockResolvedValue(completedMembershipPurchase);
  });

  it("claims the purchase, sends once, and stamps it after Resend accepts", async () => {
    fetchPurchaseById.mockResolvedValue(completedMembershipPurchase);

    await sendPurchaseConfirmationEmail(adminDb, "purchase-1");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(claimPurchaseConfirmationEmail).toHaveBeenCalledWith(
      adminDb,
      "purchase-1"
    );
    expect(updatePurchase).toHaveBeenCalledWith(
      adminDb,
      "purchase-1",
      expect.objectContaining({
        confirmation_email_sent_at: expect.any(String),
      })
    );
  });

  it("does not resend when the purchase was already emailed", async () => {
    fetchPurchaseById.mockResolvedValue({
      ...completedMembershipPurchase,
      confirmation_email_sent_at: "2026-08-01T00:00:00Z",
    });

    await sendPurchaseConfirmationEmail(adminDb, "purchase-1");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(claimPurchaseConfirmationEmail).not.toHaveBeenCalled();
    expect(updatePurchase).not.toHaveBeenCalled();
  });

  it("does not send when another request has already claimed the purchase", async () => {
    fetchPurchaseById.mockResolvedValue(completedMembershipPurchase);
    claimPurchaseConfirmationEmail.mockResolvedValue(null);

    await sendPurchaseConfirmationEmail(adminDb, "purchase-1");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(updatePurchase).not.toHaveBeenCalled();
  });

  it("skips purchases that are not completed", async () => {
    fetchPurchaseById.mockResolvedValue({
      ...completedMembershipPurchase,
      status: "pending",
    });

    await sendPurchaseConfirmationEmail(adminDb, "purchase-1");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(claimPurchaseConfirmationEmail).not.toHaveBeenCalled();
  });

  it("swallows sender failures so fulfillment is never broken", async () => {
    fetchPurchaseById.mockResolvedValue(completedMembershipPurchase);
    sendEmail.mockRejectedValue(new Error("Resend is down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      sendPurchaseConfirmationEmail(adminDb, "purchase-1")
    ).resolves.toBeUndefined();

    expect(updatePurchase).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not mark the email sent when delivery is disabled", async () => {
    fetchPurchaseById.mockResolvedValue(completedMembershipPurchase);
    sendEmail.mockResolvedValue(false);

    await sendPurchaseConfirmationEmail(adminDb, "purchase-1");

    expect(claimPurchaseConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(updatePurchase).not.toHaveBeenCalled();
  });
});
