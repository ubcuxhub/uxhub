import { CircleMinus, Inbox } from "lucide-react";

import {
  StatusBadge,
  type StatusBadgeProps,
  type StatusBadgeSpec,
} from "@/components/ui/status-badge";
import type { ApplicationReviewState } from "@/features/admin/lib/application-review";

/**
 * One word per review state, the same on the badge, the filter chip and the
 * decision card (docs/design/application-review.md, "Status copy"). Admin
 * wording: "Submitted" and "Rejected" where students read "Under review" and
 * "Not selected"; a registered applicant is "Going" (§2.9: a registrant's
 * status is always Going).
 */
export const REVIEW_STATE_BADGES: Record<ApplicationReviewState, StatusBadgeSpec & { label: string }> = {
  submitted: { label: "Submitted", tone: "warning", icon: Inbox },
  waitlisted: { status: "waitlisted", label: "Waitlisted" },
  accepted: { status: "accepted", label: "Accepted" },
  registered: { status: "going", label: "Going" },
  offer_expired: { status: "offer_expired", label: "Offer expired" },
  rejected: { label: "Rejected", tone: "neutral", icon: CircleMinus },
};

/** The filter chips' order: the review queue first, then by how far along. */
export const REVIEW_STATE_ORDER: readonly ApplicationReviewState[] = [
  "submitted",
  "waitlisted",
  "accepted",
  "registered",
  "offer_expired",
  "rejected",
];

export function ReviewStateBadge({
  state,
  ...props
}: { state: ApplicationReviewState } & Omit<StatusBadgeProps, keyof StatusBadgeSpec>) {
  return <StatusBadge {...REVIEW_STATE_BADGES[state]} {...props} />;
}
