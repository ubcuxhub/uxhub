"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/types/models";
import { Clock, X, Check, User, Mail, Calendar } from "lucide-react";
import { formatTimestamp } from "@/lib/date";

interface ApplicantInfoCardProps {
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
}

function getStatusIcon(status: ApplicationStatus) {
  switch (status) {
    case "pending":
      return <Clock className="text-warning" />;
    case "declined":
      return <X className="text-destructive" />;
    case "accepted":
      return <Check className="text-success" />;
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
            {getStatusIcon(status)}
            <Badge variant="outline" className="capitalize">
              {getStatusText(status)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <Calendar />
          <span>Applied: {formatTimestamp(applicationDate)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
