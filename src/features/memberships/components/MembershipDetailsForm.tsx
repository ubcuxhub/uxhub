"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FlowLink } from "@/components/shared/FlowLink";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Badge } from "@/components/ui/badge";
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
import { FACULTIES, STUDENT_STATUSES, YEAR_LEVELS } from "@/lib/constants";
import { withReturnTo } from "@/lib/auth/paths";
import { useUser } from "@/lib/auth/user-context";
import type {
  StudentStatus,
  UniversityYear,
  UserInfoRow,
} from "@/lib/supabase/models";
import {
  saveMembershipProfileAction,
  sendUbcCodeAction,
  verifyUbcCodeAction,
  type MembershipProfileInput,
  type MembershipProfileResult,
} from "@/features/memberships/actions";
import type { PendingUbcCode } from "@/features/memberships/lib/ubc-verification";
import {
  CHANGE_USER_TYPE_PATH,
  userTypeToAudience,
  type MembershipAudience,
} from "@/features/memberships/lib/policy";
import {
  ASYNC_DEADLINES,
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { UbcCodeStep, type UbcCodeClient, type UbcCodeStart } from "./UbcCodeStep";

/** What the details step knows about a UBC member's verification. */
export interface UbcDetails {
  /** The confirmed sign-in email, when it qualifies for this audience: it proves itself. */
  signInEmail: string | null;
  /** A live code for the saved address, to reopen the code state after a refresh. */
  pending: PendingUbcCode | null;
}

/** The server calls the step makes; the dev templates swap in a fake. */
export interface MembershipDetailsClient extends UbcCodeClient {
  saveProfile: (input: MembershipProfileInput) => Promise<MembershipProfileResult>;
}

const SERVER_CLIENT: MembershipDetailsClient = {
  saveProfile: saveMembershipProfileAction,
  sendCode: sendUbcCodeAction,
  verifyCode: verifyUbcCodeAction,
};

const UBC_EMAIL_FIELD = {
  student: {
    label: "UBC student email",
    placeholder: "name@student.ubc.ca",
    hint: "Your @student.ubc.ca address. We’ll email it a code to confirm you’re a UBC student.",
  },
  faculty: {
    label: "UBC faculty email",
    placeholder: "name@ubc.ca",
    hint: "Your ubc.ca address, such as name@ubc.ca or name@cs.ubc.ca. We’ll email it a code.",
  },
} as const;

const NO_UBC_DETAILS: UbcDetails = { signInEmail: null, pending: null };

/** Offered beside "Change" when join skipped "What best describes you?". */
export const CHANGE_USER_TYPE_PROMPT: Record<MembershipAudience, string> = {
  student: "Not a UBC student?",
  faculty: "Not UBC faculty or staff?",
  "non-ubc": "From UBC?",
};

/**
 * Whether this is the type the member already answered (in setup or an
 * earlier join). Join then skipped the question, so the form offers a way
 * back to it instead of a Back that would skip it again.
 */
export function isConfirmedAudience(
  user: Pick<UserInfoRow, "user_type" | "user_type_confirmed_at">,
  audience: MembershipAudience,
) {
  return (
    user.user_type_confirmed_at !== null &&
    userTypeToAudience(user.user_type) === audience
  );
}

export function MembershipDetailsForm({
  audience,
  client = SERVER_CLIENT,
  onContinue,
  returnTo,
  ubc = NO_UBC_DETAILS,
  user,
}: {
  audience: MembershipAudience;
  client?: MembershipDetailsClient;
  /** Replaces the navigation to tiers once nothing is left to prove: for previews. */
  onContinue?: () => void;
  returnTo?: string;
  ubc?: UbcDetails;
  user: UserInfoRow;
}) {
  const confirmed = isConfirmedAudience(user, audience);
  // With an answer on record, the plain join step would skip straight back here.
  const questionHref = withReturnTo(
    user.user_type_confirmed_at !== null
      ? CHANGE_USER_TYPE_PATH
      : "/portal/membership/join",
    returnTo ?? "/portal",
  );
  const router = useRouter();
  const { setBusy } = useFlowDialog();
  const { refreshUser } = useUser();
  const [studentNumber, setStudentNumber] = useState(
    user.student_number?.toString() ?? "",
  );
  const [faculty, setFaculty] = useState(user.faculty ?? "");
  const [year, setYear] = useState<UniversityYear | "">(user.year ?? "");
  const [major, setMajor] = useState(user.major ?? "");
  const ubcAudience = audience === "non-ubc" ? null : audience;
  const savedAudience = userTypeToAudience(user.user_type) === audience;
  // A qualifying confirmed sign-in email is the address, locked: it proves itself.
  const lockedUbcEmail = ubcAudience ? ubc.signInEmail : null;
  const [ubcEmail, setUbcEmail] = useState(
    lockedUbcEmail ??
      (savedAudience ? (user.ubc_email ?? user.faculty_email ?? "") : ""),
  );
  const ubcEmailId = useId();
  const ubcEmailRef = useRef<HTMLInputElement>(null);
  const [codeStep, setCodeStep] = useState<{ email: string; start: UbcCodeStart } | null>(() =>
    ubcAudience && savedAudience && ubc.pending && ubc.pending.email === user.ubc_email
      ? { email: ubc.pending.email, start: { kind: "pending", pending: ubc.pending } }
      : null,
  );
  const [schoolInstitution, setSchoolInstitution] = useState(
    user.school_institution ?? "",
  );
  const [studentStatus, setStudentStatus] = useState<StudentStatus | "">(
    user.student_status ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [navigationTimedOut, setNavigationTimedOut] = useState(false);
  const pending = saving || (navigating && !navigationTimedOut);
  const recoverStalledNavigation = useNavigationRecovery(() => {
    setNavigationTimedOut(true);
    setBusy(false);
    setError(
      "Your details were saved, but the next page did not load. Try continuing again.",
    );
  });

  const proceed = useCallback(() => {
    if (onContinue) {
      onContinue();
      return;
    }
    void withDeadline(() => refreshUser(), {
      operation: "Refreshing membership details",
      timeoutMs: ASYNC_DEADLINES.userAction,
    }).catch(() => undefined);

    startNavigation(() => {
      router.replace(withReturnTo("/portal/membership", returnTo ?? "/portal"));
      router.refresh();
    });
    recoverStalledNavigation();
  }, [onContinue, recoverStalledNavigation, refreshUser, returnTo, router]);

  const changeEmail = () => {
    setCodeStep(null);
    setError(null);
    // Back to the address, with focus where the change happens.
    requestAnimationFrame(() => ubcEmailRef.current?.focus());
  };

  const save = async () => {
    if (pending) return;

    let input: MembershipProfileInput;
    if (audience === "student") {
      if (!studentNumber || !faculty || !year || !major.trim() || !ubcEmail.trim()) {
        setError("Complete all required fields before continuing.");
        return;
      }
      input = {
        audience,
        studentNumber,
        faculty,
        year,
        major,
        ubcEmail,
      };
    } else if (audience === "faculty") {
      if (!ubcEmail.trim()) {
        setError("Enter your UBC faculty email.");
        return;
      }
      input = { audience, ubcEmail, faculty };
    } else {
      input = { audience, schoolInstitution, studentStatus, year };
    }

    setSaving(true);
    setBusy(true);
    setNavigationTimedOut(false);
    setError(null);

    try {
      const result = await withDeadline(
        () => client.saveProfile(input),
        {
          operation: "Saving membership details",
          timeoutMs: ASYNC_DEADLINES.userAction,
        },
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.verification === "code") {
        setCodeStep({ email: result.email, start: { kind: "send", result: result.send } });
        return;
      }
      proceed();
    } catch (saveError) {
      setError(
        isAsyncTimeoutError(saveError)
          ? getAsyncErrorMessage(saveError)
          : "Your membership details could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
      setBusy(false);
    }
  };

  if (codeStep) {
    return (
      <UbcCodeStep
        client={client}
        email={codeStep.email}
        start={codeStep.start}
        onBusyChange={setBusy}
        onChangeEmail={changeEmail}
        onVerified={proceed}
      />
    );
  }

  const ubcEmailField = ubcAudience ? (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={ubcEmailId}>{UBC_EMAIL_FIELD[ubcAudience].label} *</Label>
        {lockedUbcEmail ? <Badge variant="success">Verified</Badge> : null}
      </div>
      <Input
        ref={ubcEmailRef}
        id={ubcEmailId}
        type="email"
        autoComplete="email"
        value={ubcEmail}
        readOnly={lockedUbcEmail !== null}
        aria-describedby={`${ubcEmailId}-hint`}
        onChange={(event) => setUbcEmail(event.target.value)}
        placeholder={UBC_EMAIL_FIELD[ubcAudience].placeholder}
      />
      <p id={`${ubcEmailId}-hint`} className="text-small text-muted-foreground">
        {lockedUbcEmail
          ? "Your sign-in email already proves you’re at UBC, so there’s no code to enter."
          : UBC_EMAIL_FIELD[ubcAudience].hint}
      </p>
    </div>
  ) : null;

  return (
    <div className="flex min-h-full flex-col">
      <div>
        <h1 className="text-h2">Enter your details</h1>
        <p className="mt-2 text-small text-muted-foreground">
          {audience === "student"
            ? "You can change your other details later, but make sure your student number is correct before continuing."
            : "You can change this information later."}
        </p>
        {confirmed ? (
          <p className="mt-2 text-small text-muted-foreground">
            {CHANGE_USER_TYPE_PROMPT[audience]}{" "}
            <Button asChild variant="link" size="sm" disabled={pending}>
              <FlowLink href={questionHref} replace>
                Change
              </FlowLink>
            </Button>
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-5">
        {audience === "student" ? (
          <>
            <Field label="UBC student number" required>
              <Input
                inputMode="numeric"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="Enter your student number"
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
            {ubcEmailField}
          </>
        ) : audience === "faculty" ? (
          <>
            {ubcEmailField}
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

      {error ? (
        <p className="mt-4 text-small text-destructive">{error}</p>
      ) : null}

      <div className="mt-auto flex justify-between gap-4 pt-8">
        {confirmed ? (
          <span />
        ) : (
          <Button asChild variant="outline" disabled={pending}>
            <FlowLink href={questionHref} replace>
              Back
            </FlowLink>
          </Button>
        )}
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Next"}
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
        {label}
        {required ? " *" : ""}
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
