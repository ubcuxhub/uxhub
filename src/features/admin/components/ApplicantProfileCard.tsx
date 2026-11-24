"use client";

import { useId } from "react";
import { Copy } from "lucide-react";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { toast } from "@/components/ui/toast";
import {
  STUDENT_STATUS_LABELS,
  membershipLabel,
} from "@/features/admin/lib/application-review";
import { YEAR_LABELS } from "@/lib/constants";
import { formatEventDate, formatTimestamp } from "@/lib/date";
import type { StudentStatus, UniversityYear } from "@/lib/supabase/models";

/** Who applied, as the review page shows them. */
export interface ApplicantProfile {
  name: string;
  email: string;
  program: string | null;
  year: UniversityYear | null;
  studentStatus: StudentStatus | null;
  /** The active membership tier's stored name; null for a non-member. */
  membership: string | null;
}

interface ApplicantProfileCardProps {
  applicant: ApplicantProfile;
  submittedAt: string;
  /**
   * The avatar, name and submitted date above the details. Off where the page
   * header already shows them.
   */
  showIdentity?: boolean;
}

/**
 * DetailRow switches to label-beside-value at the `sm` viewport, but this card
 * sits in a narrow aside: here the switch follows the card's own width.
 */
const ROW =
  "grid-cols-(--profile-cols) sm:grid-cols-(--profile-cols) gap-x-4 gap-y-1 sm:gap-x-4 sm:gap-y-1";

/**
 * The applicant's profile beside their answers. Missing values read as "—"
 * (DetailRow), long names and emails wrap, and the email has a copy button
 * besides its mailto link.
 */
export function ApplicantProfileCard({
  applicant,
  submittedAt,
  showIdentity = true,
}: ApplicantProfileCardProps) {
  const titleId = useId();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(applicant.email);
    } catch {
      toast.error("Couldn’t copy the email", {
        description: "Select the address and copy it yourself.",
      });
      return;
    }
    toast.success("Email copied");
  };

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId} role="heading" aria-level={2}>
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="@container flex flex-col gap-4">
        {showIdentity ? (
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={applicant.name} size={64} decorative />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="break-words text-h3">{applicant.name}</p>
              <p className="text-small text-muted-foreground">
                Submitted {formatEventDate(submittedAt, { month: "short" })}
              </p>
            </div>
          </div>
        ) : null}
        <DetailList className="[--profile-cols:minmax(0,1fr)] @[18rem]:[--profile-cols:minmax(0,7.5rem)_minmax(0,1fr)]">
          <DetailRow label="Email" className={ROW}>
            {applicant.email ? (
              <span className="flex items-start gap-2">
                <a
                  href={`mailto:${applicant.email}`}
                  className="min-w-0 flex-1 [overflow-wrap:anywhere] underline-offset-4 hover:underline focus-visible:focus-ring"
                >
                  {applicant.email}
                </a>
                <IconButton
                  label="Copy email"
                  variant="ghost"
                  size="icon-sm"
                  className="-my-1 shrink-0"
                  onClick={() => void copyEmail()}
                >
                  <Copy aria-hidden />
                </IconButton>
              </span>
            ) : null}
          </DetailRow>
          <DetailRow label="Year" className={ROW}>
            {applicant.year ? YEAR_LABELS[applicant.year] : null}
          </DetailRow>
          <DetailRow label="Program" className={ROW}>{applicant.program}</DetailRow>
          <DetailRow label="Membership" className={ROW}>
            {membershipLabel(applicant.membership)}
          </DetailRow>
          <DetailRow label="Student status" className={ROW}>
            {applicant.studentStatus
              ? STUDENT_STATUS_LABELS[applicant.studentStatus]
              : null}
          </DetailRow>
          <DetailRow label="Submitted" className={`${ROW} border-b-0`}>
            {formatTimestamp(submittedAt)}
          </DetailRow>
        </DetailList>
      </CardContent>
    </Card>
  );
}
