"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStateIcon } from "@/features/admin/components/ApplicantInfoCard";
import {
  APPLICATION_REVIEW_STATE_LABELS,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import { formatTimestamp } from "@/lib/date";

interface ApplicationListCardProps {
  applicationId: string;
  name: string;
  email: string;
  applicationDate: string;
  state: ApplicationReviewState;
  eventId: string;
}

export function ApplicationListCard({
  applicationId,
  name,
  email,
  applicationDate,
  state,
  eventId,
}: ApplicationListCardProps) {
  return (
    <Link
      href={`/admin/events/${eventId}/review-applications/${applicationId}`}
    >
      <Card className="cursor-pointer transition-colors hover:bg-surface-subtle">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-subheading">{name}</CardTitle>
              <p className="text-small text-muted-foreground mt-1">{email}</p>
            </div>
            <div className="flex items-center gap-2">
              <ApplicationStateIcon state={state} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-small">
            <span className="text-muted-foreground">
              Applied: {formatTimestamp(applicationDate)}
            </span>
            <span className="text-muted-foreground">
              {APPLICATION_REVIEW_STATE_LABELS[state]}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
