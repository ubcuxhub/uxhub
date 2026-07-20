"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FlowLink } from "@/components/shared/FlowLink";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import { withReturnTo } from "@/lib/auth/paths";
import { useUser } from "@/context/UserContext";
import type {
  StudentStatus,
  UniversityYear,
  UserInfoRow,
} from "@/types/models";
import {
  saveMembershipProfileAction,
  type MembershipProfileInput,
} from "@/features/memberships/actions";
import type { MembershipAudience } from "@/features/memberships/lib/policy";

const STUDENT_STATUSES: Array<{ value: StudentStatus; label: string }> = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "other", label: "Other" },
];

export function MembershipDetailsForm({
  audience,
  returnTo,
  user,
}: {
  audience: MembershipAudience;
  returnTo?: string;
  user: UserInfoRow;
}) {
  const router = useRouter();
  const { setBusy } = useFlowDialog();
  const { refreshUser } = useUser();
  const [studentNumber, setStudentNumber] = useState(
    user.student_number?.toString() ?? "",
  );
  const [faculty, setFaculty] = useState(user.faculty ?? "");
  const [year, setYear] = useState<UniversityYear | "">(user.year ?? "");
  const [major, setMajor] = useState(user.major ?? "");
  const [facultyEmail, setFacultyEmail] = useState(user.faculty_email ?? "");
  const [schoolInstitution, setSchoolInstitution] = useState(
    user.school_institution ?? "",
  );
  const [studentStatus, setStudentStatus] = useState<StudentStatus | "">(
    user.student_status ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let input: MembershipProfileInput;
    if (audience === "student") {
      if (!studentNumber || !faculty || !year || !major.trim()) {
        setError("Complete all required fields before continuing.");
        return;
      }
      input = {
        audience,
        studentNumber,
        faculty,
        year,
        major,
      };
    } else if (audience === "faculty") {
      if (!facultyEmail.trim()) {
        setError("Enter your UBC faculty email.");
        return;
      }
      input = { audience, facultyEmail, faculty };
    } else {
      input = { audience, schoolInstitution, studentStatus, year };
    }

    setSaving(true);
    setBusy(true);
    setError(null);
    const result = await saveMembershipProfileAction(input);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      setBusy(false);
      return;
    }

    await refreshUser();
    router.replace(
      withReturnTo("/portal/membership", returnTo ?? "/portal"),
    );
    router.refresh();
  };

  return (
    <div className="flex min-h-full flex-col">
      <div>
        <h1 className="text-h2">Enter your details</h1>
        <p className="mt-2 text-small text-muted-foreground">
          You can change this information later.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        {audience === "student" ? (
          <>
            <Field label="UBC student number" required>
              <Input
                inputMode="numeric"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="12345678"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <FacultyField value={faculty} onChange={setFaculty} required />
              <YearField value={year} onChange={setYear} required />
            </div>
            <Field label="Major" required>
              <Input
                value={major}
                onChange={(event) => setMajor(event.target.value)}
                placeholder="Enter your major"
              />
            </Field>
          </>
        ) : audience === "faculty" ? (
          <>
            <Field label="UBC faculty email" required>
              <Input
                type="email"
                value={facultyEmail}
                onChange={(event) => setFacultyEmail(event.target.value)}
                placeholder="name@ubc.ca"
              />
            </Field>
            <FacultyField value={faculty} onChange={setFaculty} />
          </>
        ) : (
          <>
            <Field label="School/institution">
              <Input
                value={schoolInstitution}
                onChange={(event) => setSchoolInstitution(event.target.value)}
                placeholder="Enter your school or institution"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Student status">
                <Select
                  value={studentStatus}
                  onValueChange={(value: StudentStatus) =>
                    setStudentStatus(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <YearField value={year} onChange={setYear} />
            </div>
          </>
        )}
      </div>

      {error ? <p className="mt-4 text-small text-destructive">{error}</p> : null}

      <div className="mt-auto flex justify-between gap-4 pt-8">
        <Button asChild variant="outline" disabled={saving}>
          <FlowLink
            href={withReturnTo(
              "/portal/membership/join",
              returnTo ?? "/portal",
            )}
            replace
          >
            Back
          </FlowLink>
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
  required = false,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}{required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}

function FacultyField({
  onChange,
  required = false,
  value,
}: {
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <Field label="Faculty" required={required}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select faculty" />
        </SelectTrigger>
        <SelectContent>
          {FACULTIES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function YearField({
  onChange,
  required = false,
  value,
}: {
  onChange: (value: UniversityYear) => void;
  required?: boolean;
  value: UniversityYear | "";
}) {
  return (
    <Field label="Year" required={required}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select year" />
        </SelectTrigger>
        <SelectContent>
          {YEAR_LEVELS.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
