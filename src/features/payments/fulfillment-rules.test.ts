import { describe, expect, it } from "vitest";
import { SquareError } from "square";
import {
  formatReservationFailure,
  getSquareErrorMessage,
  normalizeSquareStatus,
  splitBuyerName,
} from "./fulfillment-rules";
import { isMembershipPurchasableForUser } from "@/features/memberships/lib/eligibility";

describe("payment fulfillment rules", () => {
  it.each([
    ["APPROVED", "authorized"],
    ["COMPLETED", "completed"],
    ["CANCELED", "canceled"],
    ["FAILED", "failed"],
    ["PENDING", "pending"],
    [undefined, "pending"],
  ])("normalizes Square status %s", (status, expected) => {
    expect(normalizeSquareStatus(status)).toBe(expected);
  });

  it.each([
    ["Ada Lovelace", { givenName: "Ada", familyName: "Lovelace" }],
    ["  Ada   Byron Lovelace ", { givenName: "Ada", familyName: "Byron Lovelace" }],
    ["Ada", { givenName: "Ada", familyName: undefined }],
    [" ", { givenName: undefined, familyName: undefined }],
  ])("splits buyer name %j", (name, expected) => {
    expect(splitBuyerName(name)).toEqual(expected);
  });

  it("prefers a Square error detail", () => {
    const error = new SquareError({
      message: "Request failed",
      body: {
        errors: [
          {
            category: "PAYMENT_METHOD_ERROR",
            code: "CARD_DECLINED",
            detail: "Card declined",
          },
        ],
      },
    });

    expect(getSquareErrorMessage(error)).toBe("Card declined");
  });

  it("uses ordinary error messages and falls back for unknown values", () => {
    expect(getSquareErrorMessage(new Error("Network unavailable"))).toBe(
      "Network unavailable"
    );
    expect(getSquareErrorMessage(null, "Try again.")).toBe("Try again.");
  });

  it.each([
    ["APPLICATION_REQUIRED", "This event uses an application flow and cannot be purchased directly."],
    ["REGISTRATION_NOT_OPEN", "Registration for this event is not open yet."],
    ["REGISTRATION_CLOSED", "Registration for this event has closed."],
    ["ALREADY_REGISTERED", "You already have a registration for this event."],
    ["SOLD_OUT", "This event is sold out."],
    ["EVENT_NOT_FOUND", "This event could not be found."],
    [null, "We could not reserve a ticket for this event."],
  ])("formats reservation failure %s", (reason, expected) => {
    expect(formatReservationFailure(reason)).toBe(expected);
  });

  const baseUser = {
    membership_type_id: null,
    membership_pre_ordered_type_id: null,
    student_number: null,
    user_type: "nonUbc" as const,
  };

  it("allows an eligible user with no existing membership", () => {
    expect(
      isMembershipPurchasableForUser(baseUser, {
        eligible_user_types: ["nonUbc"],
      })
    ).toBe(true);
  });

  it("rejects existing members, pre-orders, and ineligible user types", () => {
    expect(
      isMembershipPurchasableForUser(
        { ...baseUser, membership_type_id: "member" },
        { eligible_user_types: ["nonUbc"] }
      )
    ).toBe(false);
    expect(
      isMembershipPurchasableForUser(
        { ...baseUser, membership_pre_ordered_type_id: "preorder" },
        { eligible_user_types: ["nonUbc"] }
      )
    ).toBe(false);
    expect(
      isMembershipPurchasableForUser(baseUser, {
        eligible_user_types: ["faculty"],
      })
    ).toBe(false);
  });

  it("requires a student number for UBC students", () => {
    const student = { ...baseUser, user_type: "ubcStudent" as const };
    const membership = { eligible_user_types: ["ubcStudent" as const] };

    expect(isMembershipPurchasableForUser(student, membership)).toBe(false);
    expect(
      isMembershipPurchasableForUser(
        { ...student, student_number: 12345678 },
        membership
      )
    ).toBe(true);
  });
});
