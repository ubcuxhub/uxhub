"use client";

import { useId, useState, type ReactNode } from "react";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutosaveStatus } from "@/features/applications/components/AutosaveStatus";
import { AvatarPicker, type AvatarChoice } from "@/features/setup/components/AvatarPicker";
import {
  DietaryFields,
  isDietaryEmpty,
  type DietaryValue,
} from "@/features/setup/components/DietaryFields";
import { InterestFields } from "@/features/setup/components/InterestFields";
import type { InterestId } from "@/features/setup/lib/options";
import { FACULTIES, STUDENT_STATUSES, YEAR_LEVELS } from "@/lib/constants";
import { formatEventDate } from "@/lib/date";
import type { StudentStatus, UniversityYear, UserInfoRow } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";
import { cn } from "@/lib/utils";

import type { ProfileFormData } from "../ProfileFields";
import {
  membershipLabel,
  roleLabel,
  STUDIES_TITLES,
  USER_TYPE_LABELS,
  type MembershipSummary,
  type ProfileSaveStates,
  type ProfileSectionId,
} from "./model";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileSection } from "./ProfileSection";

type CheckedField = "first_name" | "last_name" | "student_number";

export interface ProfileTabProps {
  /** The saved row: the header, locked fields and account facts read it. */
  user: UserInfoRow;
  membership: MembershipSummary;
  /** The stored uploaded photo's URL, if any. */
  photoUrl: string | null;

  form: ProfileFormData;
  onFormChange: (patch: Partial<ProfileFormData>) => void;
  /** Errors show after a field loses focus (§3.2); the caller tracks that. */
  onFieldBlur?: (field: CheckedField) => void;
  errors?: Partial<Record<CheckedField, string | null>>;
  /** False while a membership is active or pending: eligibility fields lock. */
  canEditEligibility: boolean;

  avatarChoice: AvatarChoice;
  onAvatarChoiceChange: (choice: AvatarChoice) => void;
  onUpload: (photo: Blob) => Promise<void>;

  dietary: DietaryValue;
  onDietaryChange: (value: DietaryValue) => void;
  interests: InterestId[];
  onInterestsChange: (value: InterestId[]) => void;

  saveStates: ProfileSaveStates;
  onRetry: (section: ProfileSectionId) => void;
  /** Opens with the photo chooser showing (the dev templates use it). */
  defaultPhotoOpen?: boolean;
}

/**
 * Proposed Profile tab for the Settings dialog (docs/design/profile-settings.md).
 * Presentational: the caller owns the values and the saving, and reports each
 * section's autosave in `saveStates`. Not wired into `SettingsDialog` yet.
 */
export function ProfileTab({
  user,
  membership,
  photoUrl,
  form,
  onFormChange,
  onFieldBlur,
  errors = {},
  canEditEligibility,
  avatarChoice,
  onAvatarChoiceChange,
  onUpload,
  dietary,
  onDietaryChange,
  interests,
  onInterestsChange,
  saveStates,
  onRetry,
  defaultPhotoOpen = false,
}: ProfileTabProps) {
  const photoPanelId = useId();
  const [photoOpen, setPhotoOpen] = useState(defaultPhotoOpen);
  // The header shows the name as typed, but never goes blank mid-edit.
  const name = formatUserName(form) || formatUserName(user) || user.email;
  const dietaryUnanswered = !dietary.none && isDietaryEmpty(dietary);

  return (
    <div className="@container/profile flex flex-col">
      <div className="flex flex-col gap-4 pb-8">
        <ProfileHeader
          name={name}
          email={user.email}
          photoUrl={avatarChoice?.kind === "photo" ? photoUrl : null}
          preset={avatarChoice?.kind === "preset" ? avatarChoice.preset : null}
          membership={membership}
          role={roleLabel(user.role_access)}
          photoOpen={photoOpen}
          onPhotoToggle={() => setPhotoOpen((open) => !open)}
          photoPanelId={photoPanelId}
        />

        {photoOpen ? (
          <div
            id={photoPanelId}
            role="region"
            aria-label="Profile photo"
            className="flex flex-col gap-5 rounded-xl border border-border-subtle bg-section p-4 @md/profile:p-6"
          >
            <AvatarPicker
              preview={false}
              name={name}
              choice={avatarChoice}
              photoUrl={photoUrl}
              onChoiceChange={onAvatarChoiceChange}
              onUpload={onUpload}
            />
            <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <div className="min-w-0">
                {saveStates.photo && saveStates.photo.kind !== "idle" ? (
                  <AutosaveStatus state={saveStates.photo} onRetry={() => onRetry("photo")} />
                ) : (
                  <p className="text-small text-muted-foreground">
                    {photoUrl ? "Choosing an icon replaces your uploaded photo." : "Shown on your profile."}
                  </p>
                )}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPhotoOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}

        <p className="text-small text-muted-foreground">Changes save as you go.</p>
      </div>

      <ProfileSection
        title="About you"
        description="How the UX Hub team knows you at events."
        saveState={saveStates.about}
        onRetry={() => onRetry("about")}
      >
        <FieldGrid>
          <TextField
            label="First name"
            value={form.first_name}
            onChange={(first_name) => onFormChange({ first_name })}
            onBlur={() => onFieldBlur?.("first_name")}
            error={errors.first_name}
            autoComplete="given-name"
          />
          <TextField
            label="Last name"
            value={form.last_name}
            onChange={(last_name) => onFormChange({ last_name })}
            onBlur={() => onFieldBlur?.("last_name")}
            error={errors.last_name}
            autoComplete="family-name"
          />
          <TextField
            label="Pronouns"
            optional
            value={form.preferred_pronouns}
            onChange={(preferred_pronouns) => onFormChange({ preferred_pronouns })}
            placeholder="e.g. she/her"
          />
          <TextField
            label="Phone"
            optional
            type="tel"
            value={form.phone}
            onChange={(phone) => onFormChange({ phone })}
            placeholder="e.g. 604 555 0134"
            autoComplete="tel"
          />
        </FieldGrid>
      </ProfileSection>

      <ProfileSection
        title={STUDIES_TITLES[user.user_type]}
        description="Keeps your membership eligibility accurate."
        saveState={saveStates.studies}
        onRetry={() => onRetry("studies")}
      >
        <FieldGrid>
          {user.user_type === "ubcStudent" ? (
            <>
              <FacultyField value={form.faculty} onChange={(faculty) => onFormChange({ faculty })} wide />
              <TextField
                label="Major"
                value={form.major}
                onChange={(major) => onFormChange({ major })}
                placeholder="e.g. Cognitive Systems"
                wide
              />
              <YearField value={form.year} onChange={(year) => onFormChange({ year })} />
              {canEditEligibility ? (
                <TextField
                  label="Student number"
                  value={form.student_number}
                  onChange={(student_number) =>
                    onFormChange({ student_number: student_number.replace(/\D/g, "") })
                  }
                  onBlur={() => onFieldBlur?.("student_number")}
                  error={errors.student_number}
                  placeholder="8 digits"
                  inputMode="numeric"
                  maxLength={8}
                />
              ) : (
                <LockedField label="Student number" value={user.student_number?.toString()} />
              )}
            </>
          ) : user.user_type === "faculty" ? (
            <>
              <FacultyField value={form.faculty} onChange={(faculty) => onFormChange({ faculty })} wide />
              <LockedField label="Faculty email" value={user.faculty_email} wide />
            </>
          ) : (
            <>
              <TextField
                label="School or institution"
                value={form.school_institution}
                onChange={(school_institution) => onFormChange({ school_institution })}
                placeholder="e.g. Emily Carr University"
                wide
              />
              <StudentStatusField
                value={form.student_status}
                onChange={(student_status) => onFormChange({ student_status })}
              />
              <YearField value={form.year} onChange={(year) => onFormChange({ year })} />
            </>
          )}
        </FieldGrid>
      </ProfileSection>

      <ProfileSection
        title="Food and allergies"
        description="Shared with the UX Hub team so every event has food you can eat."
        meta={dietaryUnanswered ? <Badge variant="neutral">Not answered</Badge> : null}
        saveState={saveStates.dietary}
        onRetry={() => onRetry("dietary")}
      >
        <DietaryFields value={dietary} onChange={onDietaryChange} />
      </ProfileSection>

      <ProfileSection
        title="Interests"
        description="Helps us plan events you'll enjoy."
        meta={
          <Badge variant="neutral" aria-live="polite">
            {interests.length ? `${interests.length} selected` : "None selected"}
          </Badge>
        }
        saveState={saveStates.interests}
        onRetry={() => onRetry("interests")}
      >
        <InterestFields value={interests} onChange={onInterestsChange} />
      </ProfileSection>

      <ProfileSection
        title="Account"
        description="Set by UX Hub. Ask an exec if something looks wrong."
        className="pb-0"
      >
        <DetailList className="[&>div:first-child]:pt-0 [&>div:last-child]:border-b-0 [&>div:last-child]:pb-0">
          <DetailRow label="Email">{user.email}</DetailRow>
          <DetailRow label="Account type">{USER_TYPE_LABELS[user.user_type]}</DetailRow>
          <DetailRow label="Membership">
            {membership.kind === "active" && membership.expiresOn
              ? `${membershipLabel(membership)}, until ${membership.expiresOn}`
              : membershipLabel(membership)}
          </DetailRow>
          <DetailRow label="Joined">{formatEventDate(user.created_at, { month: "short" })}</DetailRow>
        </DetailList>
      </ProfileSection>
    </div>
  );
}

/** Two columns once the pane has room, one on phones; `wide` fields span both. */
function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="@container/fields">
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 @md/fields:grid-cols-2">{children}</div>
    </div>
  );
}

function Optional() {
  return <span className="text-small font-normal text-muted-foreground">Optional</span>;
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  optional,
  wide,
  error,
  type = "text",
  placeholder,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  optional?: boolean;
  wide?: boolean;
  error?: string | null;
  type?: string;
  placeholder?: string;
  inputMode?: React.ComponentProps<"input">["inputMode"];
  maxLength?: number;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Field className={cn(wide && "@md/fields:col-span-2")}>
      <FieldLabel htmlFor={id} className="items-baseline">
        {label}
        {optional ? <Optional /> : null}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/**
 * A value the member can't change here. A disabled input keeps it where they
 * would look for it, and the note says who can change it.
 */
function LockedField({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  const id = useId();
  return (
    <Field className={cn(wide && "@md/fields:col-span-2")}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value?.trim() ? value : "Not set"} disabled readOnly />
      <FieldDescription>Locked while your membership is active. Ask an exec to change it.</FieldDescription>
    </Field>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  placeholder,
  options,
  wide,
}: {
  label: string;
  value: T | "";
  onChange: (value: T) => void;
  placeholder: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <Field className={cn(wide && "@md/fields:col-span-2")}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const FACULTY_OPTIONS = FACULTIES.map((faculty) => ({ value: faculty, label: faculty }));
const YEAR_OPTIONS = YEAR_LEVELS.map((year) => ({ value: year, label: `Year ${year}` }));

function FacultyField({ value, onChange, wide }: { value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <SelectField
      label="Faculty"
      value={value}
      onChange={onChange}
      placeholder="Select a faculty"
      options={FACULTY_OPTIONS}
      wide={wide}
    />
  );
}

function YearField({ value, onChange }: { value: UniversityYear | ""; onChange: (value: UniversityYear) => void }) {
  return (
    <SelectField<UniversityYear>
      label="Year"
      value={value}
      onChange={onChange}
      placeholder="Select a year"
      options={YEAR_OPTIONS}
    />
  );
}

function StudentStatusField({
  value,
  onChange,
}: {
  value: StudentStatus | "";
  onChange: (value: StudentStatus) => void;
}) {
  return (
    <SelectField<StudentStatus>
      label="Student status"
      value={value}
      onChange={onChange}
      placeholder="Select a status"
      options={STUDENT_STATUSES}
    />
  );
}
