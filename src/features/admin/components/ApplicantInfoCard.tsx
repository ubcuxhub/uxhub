"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ApplicationStatus,
  AttendanceStatus,
  EventApplicationRow,
} from "@/types/models";
import type { UserInfoContact } from "@/lib/supabase-helpers/users";
import { Clock, X, Check, User, Mail, Calendar } from "lucide-react";
import { formatTimestamp } from "@/lib/date";

interface ApplicantInfoCardProps {
  name: string;
  email: string;
  application: EventApplicationRow;
  reviewer: UserInfoContact | null;
}

function getStatusIcon(status: ApplicationStatus) {
  switch (status) {
    case "pending":
      return <Clock className="text-warning" />;
    case "rejected":
      return <X className="text-destructive" />;
    case "accepted":
      return <Check className="text-success" />;
  }
}

function getStatusText(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getAttendanceText(status: AttendanceStatus) {
  return status.replaceAll("_", " ");
}

export function ApplicantInfoCard({
  name,
  email,
  application,
  reviewer,
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
            {getStatusIcon(application.status)}
            <Badge variant="outline" className="capitalize">
              {getStatusText(application.status)}
            </Badge>
            {application.attendance_status && (
              <Badge variant="secondary" className="capitalize">
                {getAttendanceText(application.attendance_status)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <Calendar />
          <span>Applied: {formatTimestamp(application.submitted_at)}</span>
        </div>
        {application.reviewed_at && (
          <p className="mt-2 text-small text-muted-foreground">
            Reviewed {formatTimestamp(application.reviewed_at)} by{" "}
            {reviewer?.name ?? application.reviewer_id ?? "Unknown reviewer"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
