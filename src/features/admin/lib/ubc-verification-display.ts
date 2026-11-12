import { formatEventDate } from "@/lib/date";
import {
  ubcVerificationExpiresAt,
  ubcVerificationStatus,
  type UbcVerificationUser,
} from "@/features/memberships/lib/ubc-verification";

/**
 * How admin shows a member's UBC verification: the record's "Verification"
 * line and the users list filter. See docs/design/ubc-email-verification.md,
 * "Admin".
 */

const shortDate = (value: string) => formatEventDate(value, { month: "short" }) ?? value;

/**
 * "Verified by code · jane@student.ubc.ca · Oct 3, 2026", "Grandfathered ·
 * until membership ends", "Code sent · not entered", and so on.
 * `verifiedBy` names the manager behind a manual stamp; `codeSentAt` is set
 * when an unentered code is live.
 */
export function ubcVerificationLine({
  codeSentAt = null,
  now = new Date(),
  termEndsAt,
  user,
  verifiedBy,
}: {
  codeSentAt?: string | null;
  now?: Date;
  termEndsAt: string | null;
  user: UbcVerificationUser;
  verifiedBy: string;
}) {
  const status = ubcVerificationStatus(user, { now, termEndsAt });
  switch (status.state) {
    case "n/a":
      return "Not needed for Non-UBC members";
    case "unverified":
      return codeSentAt ? `Code sent ${shortDate(codeSentAt)} · not entered` : "Not verified";
    case "expired":
      return status.via === "grandfathered"
        ? "Expired · grandfathered membership ended"
        : `Expired · ${shortDate(ubcVerificationExpiresAt(status.at))}`;
    case "verified":
      switch (status.via) {
        case "code":
          return `Verified by code · ${user.ubc_email} · ${shortDate(status.at)}`;
        case "sign_in_email":
          return `Verified by sign-in email · ${user.ubc_email} · ${shortDate(status.at)}`;
        case "manual":
          return `Verified manually · ${shortDate(status.at)} · by ${verifiedBy}`;
        case "grandfathered":
          return "Grandfathered · until membership ends";
      }
  }
}

export type UbcVerificationFilter = "verified" | "grandfathered" | "expired" | "unverified";

export const UBC_VERIFICATION_FILTERS: { value: UbcVerificationFilter; label: string }[] = [
  { value: "verified", label: "Verified" },
  { value: "grandfathered", label: "Grandfathered" },
  { value: "expired", label: "Expired" },
  { value: "unverified", label: "Not verified" },
];

/** The filter chip a user falls under, or null for Non-UBC members. */
export function ubcVerificationFilterValue(
  user: UbcVerificationUser,
  termEndsAt: string | null,
  now = new Date(),
): UbcVerificationFilter | null {
  const status = ubcVerificationStatus(user, { now, termEndsAt });
  if (status.state === "n/a") return null;
  if (status.state === "verified") {
    return status.via === "grandfathered" ? "grandfathered" : "verified";
  }
  return status.state;
}
