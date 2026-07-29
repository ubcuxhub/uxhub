"use client";

import { FlowLink } from "@/components/shared/FlowLink";
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
import { Switch } from "@/components/ui/switch";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import { formatEventDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import type {
  StudentStatus,
  UniversityYear,
  UserInfoRow,
  UserType,
} from "@/types/models";

export type ProfileFormData = {
  name: string;
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
  newsletter: boolean;
};

const USER_TYPES: Array<{ value: UserType; label: string }> = [
  { value: "ubcStudent", label: "UBC Student" },
  { value: "faculty", label: "Faculty" },
  { value: "nonUbc", label: "Non-UBC" },
];

interface ProfileFieldsProps {
  user: UserInfoRow;
  formData: ProfileFormData;
  editing: boolean;
  membershipStatus: string;
  canChangeClassification: boolean;
  patch: (values: Partial<ProfileFormData>) => void;
}

export function ProfileFields({
  user,
  formData,
  editing,
  membershipStatus,
  canChangeClassification,
  patch,
}: ProfileFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={formData.name}
          display={user.name}
          editing={editing}
          onChange={(name) => patch({ name })}
        />
        <TextField
          label="Pronouns"
          value={formData.preferred_pronouns}
          display={user.preferred_pronouns}
          editing={editing}
          onChange={(preferred_pronouns) => patch({ preferred_pronouns })}
          placeholder="e.g. she/her"
        />
        <TextField
          label="Phone"
          type="tel"
          value={formData.phone}
          display={user.phone}
          editing={editing}
          onChange={(phone) => patch({ phone })}
        />
        {user.user_type === "ubcStudent" ? (
          <TextField
            label="Student number"
            type="number"
            value={formData.student_number}
            display={user.student_number?.toString()}
            editing={editing}
            onChange={(student_number) => patch({ student_number })}
          />
        ) : null}

        <Row label="User type">
          <div className="flex min-h-9 items-center justify-between gap-3">
            <ReadValue>
              {USER_TYPES.find((type) => type.value === user.user_type)?.label ??
                user.user_type}
            </ReadValue>
            {canChangeClassification ? (
              <Button asChild variant="outline">
                <FlowLink href="/portal/membership/join">Change</FlowLink>
              </Button>
            ) : null}
          </div>
        </Row>

        {user.user_type === "ubcStudent" ? (
          <>
            <FacultySetting
              editing={editing}
              value={formData.faculty}
              display={user.faculty}
              onChange={(faculty) => patch({ faculty })}
            />
            <TextField
              label="Major"
              value={formData.major}
              display={user.major}
              editing={editing}
              onChange={(major) => patch({ major })}
            />
            <YearSetting
              editing={editing}
              value={formData.year}
              display={user.year}
              onChange={(year) => patch({ year })}
            />
          </>
        ) : user.user_type === "faculty" ? (
          <>
            <TextField
              label="Faculty email"
              type="email"
              value={formData.faculty_email}
              display={user.faculty_email}
              editing={false}
              onChange={(faculty_email) => patch({ faculty_email })}
            />
            <FacultySetting
              editing={editing}
              value={formData.faculty}
              display={user.faculty}
              onChange={(faculty) => patch({ faculty })}
            />
          </>
        ) : (
          <>
            <TextField
              label="School/institution"
              value={formData.school_institution}
              display={user.school_institution}
              editing={false}
              onChange={(school_institution) => patch({ school_institution })}
            />
            <Row label="Student status">
              <ReadValue className="capitalize">
                {user.student_status}
              </ReadValue>
            </Row>
            <YearSetting
              editing={editing}
              value={formData.year}
              display={user.year}
              onChange={(year) => patch({ year })}
            />
          </>
        )}

        <div className="sm:col-span-2">
          <TextField
            label="Dietary restrictions"
            value={formData.dietary_restrictions}
            display={user.dietary_restrictions}
            editing={editing}
            onChange={(dietary_restrictions) =>
              patch({ dietary_restrictions })
            }
            placeholder="e.g. Vegetarian"
          />
        </div>
        <Row label="Newsletter">
          {editing ? (
            <Switch
              checked={formData.newsletter}
              onCheckedChange={(newsletter) => patch({ newsletter })}
              aria-label="Newsletter subscription"
            />
          ) : (
            <ReadValue>
              {user.newsletter ? "Subscribed" : "Not subscribed"}
            </ReadValue>
          )}
        </Row>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Row label="Email">
            <ReadValue>{user.email}</ReadValue>
          </Row>
          <Row label="Membership">
            <ReadValue>{membershipStatus}</ReadValue>
          </Row>
          <Row label="Membership expires">
            <ReadValue>
              {formatEventDate(user.membership_expires_at, {
                month: "short",
              }) ?? "—"}
            </ReadValue>
          </Row>
          <Row label="Role">
            <ReadValue className="capitalize">{user.role_access}</ReadValue>
          </Row>
          <Row label="Joined">
            <ReadValue>
              {formatEventDate(user.created_at, { month: "short" }) ?? "—"}
            </ReadValue>
          </Row>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const empty =
    children == null ||
    children === "" ||
    (typeof children === "string" && !children.trim());
  return (
    <div className={cn("flex min-h-9 items-center text-table", className)}>
      {empty ? (
        <span className="text-muted-foreground/60">—</span>
      ) : (
        children
      )}
    </div>
  );
}

function FacultySetting({
  display,
  editing,
  onChange,
  value,
}: {
  display: string | null;
  editing: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Row label="Faculty">
      {editing ? (
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
      ) : (
        <ReadValue>{display}</ReadValue>
      )}
    </Row>
  );
}

function YearSetting({
  display,
  editing,
  onChange,
  value,
}: {
  display: UniversityYear | null;
  editing: boolean;
  onChange: (value: UniversityYear) => void;
  value: UniversityYear | "";
}) {
  return (
    <Row label="Year">
      {editing ? (
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
      ) : (
        <ReadValue>{display}</ReadValue>
      )}
    </Row>
  );
}

function TextField({
  label,
  value,
  display,
  editing,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  display?: string | null;
  editing: boolean;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Row label={label}>
      {editing ? (
        <Input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <ReadValue>{display}</ReadValue>
      )}
    </Row>
  );
}
