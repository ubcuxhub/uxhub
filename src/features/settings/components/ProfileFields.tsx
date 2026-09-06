"use client";

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
import { formatEventDate } from "@/lib/date";
import { getEffectiveMembershipExpiry } from "@/lib/membership";
import { cn } from "@/lib/utils";
import type {
  StudentStatus,
  UniversityYear,
  UserInfoRow,
  UserType,
} from "@/types/models";

export type ProfileFormData = {
  first_name: string;
  last_name: string;
  preferred_pronouns: string;
  phone: string;
  student_number: string;
  user_type: UserType;
  faculty: string;
  faculty_email: string;
  major: string;
  school_institution: string;
  student_status: StudentStatus | "";
  year: UniversityYear | "";
  dietary_restrictions: string;
};

const USER_TYPES: Array<{ value: UserType; label: string }> = [
  { value: "ubcStudent", label: "UBC Student" },
  { value: "faculty", label: "Faculty" },
  { value: "nonUbc", label: "Non-UBC" },
];

interface ProfileFieldsProps {
  user: UserInfoRow;
  formData: ProfileFormData;
  membershipStatus: string;
  /** Club-wide membership ceiling, or null when none is set. */
  membershipTermEndsAt: string | null;
  /**
   * False once a membership is active or pending — the server refuses
   * eligibility edits then, so the field locks instead of failing on save.
   */
  canEditEligibility: boolean;
  /** Format/uniqueness complaint about the typed student number, if any. */
  studentNumberError: string | null;
  firstNameError: string | null;
  lastNameError: string | null;
  patch: (values: Partial<ProfileFormData>) => void;
}

/**
 * The profile form, split into three bands so the page says what a member can
 * act on before they read a single field: editable details first, locked
 * account facts last in a flat read-only panel that never mimics an input.
 */
export function ProfileFields({
  user,
  formData,
  membershipStatus,
  membershipTermEndsAt,
  canEditEligibility,
  studentNumberError,
  firstNameError,
  lastNameError,
  patch,
}: ProfileFieldsProps) {
  return (
    <div className="space-y-8">
      <Section title="About you">
        <TextField
          label="First name"
          value={formData.first_name}
          onChange={(first_name) => patch({ first_name })}
          error={firstNameError}
        />
        <TextField
          label="Last name"
          value={formData.last_name}
          onChange={(last_name) => patch({ last_name })}
          error={lastNameError}
        />
        <TextField
          label="Pronouns"
          value={formData.preferred_pronouns}
          onChange={(preferred_pronouns) => patch({ preferred_pronouns })}
          placeholder="e.g. she/her"
        />
        <TextField
          label="Phone"
          type="tel"
          value={formData.phone}
          onChange={(phone) => patch({ phone })}
          placeholder="e.g. 604 555 0134"
        />
        <TextField
          label="Dietary restrictions"
          value={formData.dietary_restrictions}
          onChange={(dietary_restrictions) => patch({ dietary_restrictions })}
          placeholder="e.g. Vegetarian"
          hint="Used when we cater events."
        />
      </Section>

      <Section
        title={user.user_type === "faculty" ? "At UBC" : "Studies"}
        description="Keeps your membership eligibility and event sign-ups accurate."
      >
        {user.user_type === "ubcStudent" ? (
          <>
            <FacultyField
              value={formData.faculty}
              onChange={(faculty) => patch({ faculty })}
            />
            <TextField
              label="Major"
              value={formData.major}
              onChange={(major) => patch({ major })}
              placeholder="e.g. Computer Science"
            />
            <YearField
              value={formData.year}
              onChange={(year) => patch({ year })}
            />
            {canEditEligibility ? (
              <TextField
                label="Student number"
                value={formData.student_number}
                onChange={(student_number) => patch({ student_number })}
                placeholder="Enter your student number"
                inputMode="numeric"
                maxLength={8}
                error={studentNumberError}
              />
            ) : (
              <LockedField
                label="Student number"
                value={user.student_number?.toString()}
                hint="Locked while your membership is active or pending. Ask the UX Hub team to correct it."
              />
            )}
          </>
        ) : user.user_type === "faculty" ? (
          <>
            <FacultyField
              value={formData.faculty}
              onChange={(faculty) => patch({ faculty })}
            />
            <LockedField label="Faculty email" value={user.faculty_email} />
          </>
        ) : (
          <>
            <YearField
              value={formData.year}
              onChange={(year) => patch({ year })}
            />
            <TextField
              label="School/institution"
              value={formData.school_institution}
              onChange={(school_institution) => patch({ school_institution })}
              placeholder="Enter your school or institution"
            />
            <StudentStatusField
              value={formData.student_status}
              onChange={(student_status) => patch({ student_status })}
            />
          </>
        )}
      </Section>

      <section className="space-y-3">
        <SectionHeader
          title="Account"
          description="Set by UX Hub — contact an exec if something looks wrong."
        />
        <dl className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
          <AccountRow label="Email" value={user.email} />
          <AccountRow
            label="User type"
            value={
              USER_TYPES.find((type) => type.value === user.user_type)?.label ??
              user.user_type
            }
          />
          <AccountRow label="Membership" value={membershipStatus} />
          {/* Effective date, not the raw column: a club-wide term end can cut
              a membership short, and this is where members check it. */}
          <AccountRow
            label="Membership expires"
            value={formatEventDate(
              getEffectiveMembershipExpiry(user, membershipTermEndsAt),
              { month: "short" },
            )}
          />
          <AccountRow
            label="Role"
            value={user.role_access}
            className="capitalize"
          />
          <AccountRow
            label="Joined"
            value={formatEventDate(user.created_at, { month: "short" })}
          />
        </dl>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-button">{title}</h3>
      {description ? (
        <p className="text-small text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} description={description} />
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
      {error ? (
        <p className="text-label text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-label text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * A value the member cannot edit here, shaped like an input so it lines up
 * with the fields beside it while reading as plainly locked.
 */
function LockedField({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value?: string | null;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div
        className={cn(
          "flex h-9 items-center rounded-md bg-surface-subtle px-3 text-body text-muted-foreground",
          className,
        )}
      >
        {value?.trim() ? value : "—"}
      </div>
    </Field>
  );
}

function AccountRow({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className={cn("text-table", className)}>
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

function FacultyField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field label="Faculty">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a faculty" />
        </SelectTrigger>
        <SelectContent>
          {FACULTIES.map((faculty) => (
            <SelectItem key={faculty} value={faculty}>
              {faculty}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function YearField({
  onChange,
  value,
}: {
  onChange: (value: UniversityYear) => void;
  value: UniversityYear | "";
}) {
  return (
    <Field label="Year">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select year" />
        </SelectTrigger>
        <SelectContent>
          {YEAR_LEVELS.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function StudentStatusField({
  onChange,
  value,
}: {
  onChange: (value: StudentStatus) => void;
  value: StudentStatus | "";
}) {
  return (
    <Field label="Student status">
      <Select value={value} onValueChange={onChange}>
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
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  error,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  inputMode?: React.ComponentProps<"input">["inputMode"];
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        className={error ? "border-destructive" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
