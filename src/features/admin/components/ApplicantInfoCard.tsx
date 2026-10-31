"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import {
  APPLICATION_REVIEW_STATE_LABELS,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import {
  Clock,
  X,
  Check,
  CircleMinus,
  User,
  Mail,
  Calendar,
  Ticket,
  Hourglass,
} from "lucide-react";
import { formatTimestamp } from "@/lib/date";

interface ApplicantInfoCardProps {
  name: string;
  email: string;
  applicationDate: string;
  state: ApplicationReviewState;
  offerExpiresAt: string | null;
}

export function ApplicationStateIcon({ state }: { state: ApplicationReviewState }) {
  switch (state) {
    case "submitted":
      return <Clock className="text-warning" />;
    case "waitlisted":
      return <Hourglass className="text-muted-foreground" />;
    case "accepted":
      return <Check className="text-success" />;
    case "registered":
      return <Ticket className="text-success" />;
    case "offer_expired":
      return <Clock className="text-destructive" />;
    case "rejected":
      return <X className="text-destructive" />;
  }
}

/**
 * Under review reads as pending and a registered applicant as going. A lapsed
 * offer and a rejection have no admin-facing status in the design system
 * ("Not selected" is member wording), so they keep their own labels.
 */
const BADGE_STATUS: Partial<Record<ApplicationReviewState, Status>> = {
  submitted: "pending",
  waitlisted: "waitlisted",
  accepted: "accepted",
  registered: "going",
};

function ApplicationStateBadge({ state }: { state: ApplicationReviewState }) {
  const status = BADGE_STATUS[state];
  if (status) return <StatusBadge status={status} />;
  return (
    <Badge variant="neutral">
      <CircleMinus aria-hidden />
      {APPLICATION_REVIEW_STATE_LABELS[state]}
    </Badge>
  );
}

export function ApplicantInfoCard({
  name,
  email,
  applicationDate,
  state,
  offerExpiresAt,
}: ApplicantInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <CardTitle className="flex items-center gap-2 text-subheading">
              <User className="text-muted-foreground" />
              {name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Mail />
              {email}
            </CardDescription>
          </div>
          <ApplicationStateBadge state={state} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <Calendar />
          <span>Applied: {formatTimestamp(applicationDate)}</span>
        </div>
        {(state === "accepted" || state === "offer_expired") && offerExpiresAt && (
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <Clock />
            <span>
              {state === "accepted" ? "Register by" : "Offer expired"}:{" "}
              {formatTimestamp(offerExpiresAt)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
