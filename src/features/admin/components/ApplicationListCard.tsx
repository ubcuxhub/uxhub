"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationStatus, AttendanceStatus } from "@/types/models";
import { Clock, X, Check } from "lucide-react";
import { formatTimestamp } from "@/lib/date";

interface ApplicationListCardProps {
  applicationId: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  attendanceStatus: AttendanceStatus | null;
  eventId: string;
}

export function ApplicationListCard({
  applicationId,
  name,
  email,
  applicationDate,
  status,
  attendanceStatus,
  eventId,
}: ApplicationListCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return <Clock className="text-warning" />;
      case "rejected":
        return <X className="text-destructive" />;
      case "accepted":
        return <Check className="text-success" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "pending":
        return "Pending";
      case "rejected":
        return "Rejected";
      case "accepted":
        return "Accepted";
    }
  };

  return (
    <Link
      href={`/admin/events/${eventId}/review-applications/${applicationId}`}
    >
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-subheading">{name}</CardTitle>
              <p className="text-small text-muted-foreground mt-1">{email}</p>
            </div>
            <div className="flex items-center gap-2">{getStatusIcon()}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-small">
            <span className="text-muted-foreground">
              Applied: {formatTimestamp(applicationDate)}
            </span>
            <span className="text-muted-foreground">
              {getStatusText()}
              {attendanceStatus
                ? ` · ${attendanceStatus.replaceAll("_", " ")}`
                : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
