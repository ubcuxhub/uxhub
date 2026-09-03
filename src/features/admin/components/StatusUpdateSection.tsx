"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ApplicationStatus, EventApplicationRow } from "@/types/models";
import { UserX, X, Check } from "lucide-react";

interface StatusUpdateSectionProps {
  application: EventApplicationRow;
  isUpdating: boolean;
  onDecision: (
    status: Extract<ApplicationStatus, "accepted" | "rejected">
  ) => void;
  onMarkNotAttending: () => void;
  error: string | null;
}

export function StatusUpdateSection({
  application,
  isUpdating,
  onDecision,
  onMarkNotAttending,
  error,
}: StatusUpdateSectionProps) {
  const canMarkNotAttending =
    application.status === "accepted" &&
    (application.attendance_status === "awaiting_confirmation" ||
      application.attendance_status === "confirmed");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Decision</CardTitle>
        <CardDescription>
          Review the application and manage attendance separately
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {application.status === "pending" && (
          <div className="flex gap-4">
            <Button
              variant="destructive"
              onClick={() => onDecision("rejected")}
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <X className="mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button
              variant="default"
              onClick={() => onDecision("accepted")}
              disabled={isUpdating}
              className="flex-1 bg-success hover:bg-success/90"
            >
              {isUpdating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="mr-2" />
                  Accept
                </>
              )}
            </Button>
          </div>
        )}

        {application.status === "rejected" && (
          <Button
            variant="default"
            onClick={() => onDecision("accepted")}
            disabled={isUpdating}
            className="w-full bg-success hover:bg-success/90"
          >
            {isUpdating ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Updating...
              </>
            ) : (
              <>
                <Check className="mr-2" />
                Accept Rejected Application
              </>
            )}
          </Button>
        )}

        {canMarkNotAttending && (
          <Button
            variant="outline"
            onClick={onMarkNotAttending}
            disabled={isUpdating}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Updating...
              </>
            ) : (
              <>
                <UserX className="mr-2" />
                Mark Not Attending
              </>
            )}
          </Button>
        )}

        {application.attendance_status === "not_attending" && (
          <p className="text-small text-muted-foreground">
            This accepted applicant is marked as not attending.
          </p>
        )}

        {error && <p className="text-small text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
