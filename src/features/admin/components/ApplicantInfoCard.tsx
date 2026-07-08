"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/features/events/types/applicationTypes";
import { Clock, X, Check, User, Mail, Calendar } from "lucide-react";

interface ApplicantInfoCardProps {
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getStatusIcon(status: ApplicationStatus) {
  switch (status) {
    case "pending":
      return <Clock className="text-yellow-500" />;
    case "declined":
      return <X className="text-red-500" />;
    case "accepted":
      return <Check className="text-green-500" />;
  }
}

function getStatusText(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ApplicantInfoCard({
  name,
  email,
  applicationDate,
  status,
}: ApplicantInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="text-muted-foreground" />
              {name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Mail />
              {email}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <Badge variant="outline" className="capitalize">
              {getStatusText(status)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar />
          <span>Applied: {formatDate(applicationDate)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
