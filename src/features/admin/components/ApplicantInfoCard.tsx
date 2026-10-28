"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  APPLICATION_REVIEW_STATE_LABELS,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import { Clock, X, Check, User, Mail, Calendar, Ticket, Hourglass } from "lucide-react";
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
          <div className="flex items-center gap-2">
            <ApplicationStateIcon state={state} />
            <Badge variant="outline">
              {APPLICATION_REVIEW_STATE_LABELS[state]}
            </Badge>
          </div>
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
