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
import type { ApplicationStatus } from "@/features/events/types/applicationTypes";
import { X, Check } from "lucide-react";

interface StatusUpdateSectionProps {
  currentStatus: ApplicationStatus;
  isUpdating: boolean;
  onStatusUpdate: (status: ApplicationStatus) => void;
  error: string | null;
}

export function StatusUpdateSection({
  currentStatus,
  isUpdating,
  onStatusUpdate,
  error,
}: StatusUpdateSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Application Status</CardTitle>
        <CardDescription>Change the status of this application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentStatus === "pending" ? (
          <div className="flex gap-4">
            <Button
              variant="destructive"
              onClick={() => onStatusUpdate("declined")}
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
                  <X className="mr-2 h-4 w-4" />
                  Decline
                </>
              )}
            </Button>
            <Button
              variant="default"
              onClick={() => onStatusUpdate("accepted")}
              disabled={isUpdating}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isUpdating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Accept
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => onStatusUpdate("pending")}
            disabled={isUpdating}
            className="w-full "
          >
            {isUpdating ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Updating...
              </>
            ) : (
              "Open Application for Review"
            )}
          </Button>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
