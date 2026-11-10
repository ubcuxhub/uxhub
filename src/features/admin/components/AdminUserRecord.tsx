"use client";

import { useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Pencil } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CopyCode } from "@/components/shared/CopyCode";
import { RecordField, RecordSection, RecordView } from "@/components/shared/RecordDrawer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import { useUser } from "@/lib/auth/user-context";
import { formatEventDate } from "@/lib/date";
import type { RoleAccess, UserInfoRow } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";

import { saveManagerUserDetailsAction, updateUserRoleAction } from "../actions";
import { displaySchool } from "../lib/directory";
import { ubcVerificationLine } from "../lib/ubc-verification-display";
import {
  canEditUserSchool,
  createUserEditDraft,
  hasUserEdits,
  isUbcVerifiedNow,
  userEditChanges,
  type UserEditDraft,
  type UserEditField,
} from "../lib/user-edit";
import { mergeSavedUser } from "../lib/user-record";
import type { MembershipTypeOption, UserRecord } from "../types";
import { removeUserProfilePhotoAction, setStudentVerificationAction } from "../user-profile-actions";
import { MembershipTypeField } from "./MembershipTypeField";
import { displayedPhotoUrl, UserAvatarField } from "./UserAvatarField";
import { UserInterestsField } from "./UserInterestsField";

const ROLES: { value: RoleAccess; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
];
const YEARS = ["1", "2", "3", "4", "5+"];
const NO_YEAR = "__none__";
const SCHOOL_LOCKED =
  "Only Non-UBC members can change their school. Select a Non-UBC membership to edit this field.";

interface AdminUserRecordProps {
  record: UserRecord;
  /** The manager who verified this member by hand, when their profile still exists. */
  verifierName: string | null;
  /** When a UBC verification code that hasn't been entered yet was sent. */
  ubcCodeSentAt?: string | null;
  /** Active tiers, offered when editing. */
  membershipTypes: MembershipTypeOption[];
  /** Managers edit; admins only look. */
  canManage: boolean;
  /** The signed-in admin's `user_info.id`: changing their own role also refreshes the signed-in user. */
  currentUserId: string;
  /** Recent transactions, streamed in by the route. */
  transactions: ReactNode;
}

/** "Feb 29, 2000" from a `YYYY-MM-DD` date. */
function formatBirthDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function roleLabel(role: RoleAccess) {
  return ROLES.find((item) => item.value === role)?.label ?? role;
}

/**
 * One user, in the drawer over Manage users. Managers
 * edit everything in one draft and save it together; the role changes last,
 * after a confirmation, so a manager editing their own role keeps access
 * until the rest has saved.
 */
export function AdminUserRecord({
  record,
  verifierName,
  ubcCodeSentAt = null,
  membershipTypes,
  canManage,
  currentUserId,
  transactions,
}: AdminUserRecordProps) {
  const router = useRouter();
  const { refreshUser, membershipTermEndsAt } = useUser();
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  // The saved record. A server re-render after a save hands in a fresh one.
  const [user, setUser] = useState(record);
  const [lastRecord, setLastRecord] = useState(record);
  if (record !== lastRecord) {
    setLastRecord(record);
    setUser(record);
  }

  const [draft, setDraft] = useState<UserEditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<RoleAccess | null>(null);
  // Only managers get the Edit button, so only they ever hold a draft.
  const editing = draft !== null;
  const dirty = draft !== null && hasUserEdits(user, draft, membershipTermEndsAt);

  const photoPreview = draft?.photo?.preview;
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const update = (changes: Partial<UserEditDraft>) => {
    if (saving) return;
    setDraft((current) => (current ? { ...current, ...changes } : current));
    setError(null);
  };
  const setField = (field: UserEditField, value: string) => {
    if (!draft) return;
    // A new student number undoes a manual verification (the database does
    // the same); a code or sign-in email verification doesn't depend on it.
    const unverify = field === "student_number" && user.ubc_verified_via === "manual";
    update({ fields: { ...draft.fields, [field]: value }, ...(unverify ? { verified: false } : {}) });
  };

  const startEditing = () => {
    setError(null);
    setDraft(createUserEditDraft(user, membershipTermEndsAt));
  };
  const cancel = () => {
    setDraft(null);
    setError(null);
    setPendingRole(null);
  };

  const save = async () => {
    if (!draft || !canManage || saving) return;
    setSaving(true);
    setError(null);
    let updated = user;
    let savedAny = false;
    const commit = (saved: UserInfoRow) => {
      updated = mergeSavedUser(updated, saved, membershipTypes);
      setUser(updated);
      savedAny = true;
    };
    try {
      const changes = userEditChanges(updated, draft, membershipTypes);
      if (Object.keys(changes).length) {
        commit(await saveManagerUserDetailsAction(updated.id, changes));
        const savedDraft = createUserEditDraft(updated);
        setDraft((current) => current && {
          ...current,
          fields: savedDraft.fields,
          birthDate: savedDraft.birthDate,
          interests: savedDraft.interests,
          newInterest: "",
        });
      }
      if (draft.verified !== isUbcVerifiedNow(updated, membershipTermEndsAt)) {
        commit(await setStudentVerificationAction(updated.id, draft.verified));
      }
      if (draft.photo !== undefined) {
        if (draft.photo) {
          const form = new FormData();
          form.set("file", draft.photo.file);
          form.set("expectedPath", updated.profile_photo_path ?? "");
          const response = await fetch(`/api/admin/users/${updated.id}/photo`, { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to upload photo.");
          commit(data.user);
        } else if (updated.profile_photo_path) {
          commit(await removeUserProfilePhotoAction(updated.id, updated.profile_photo_path));
        }
        setDraft((current) => current && { ...current, photo: undefined });
      }
      // Last, so a manager changing their own role keeps access until the rest has saved.
      const roleChanged = draft.role !== updated.role_access;
      if (roleChanged) {
        const role = await updateUserRoleAction(updated.id, draft.role);
        updated = { ...updated, role_access: role };
        setUser(updated);
        savedAny = true;
      }
      setDraft(null);
      setPendingRole(null);
      // Your own role: the sidebar reads it from the signed-in user, which the
      // refresh below doesn't reload.
      if (roleChanged && updated.id === currentUserId) await refreshUser();
      if (savedAny) router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to save changes. Try again.";
      setError(savedAny ? `Some changes were saved. ${message} Your remaining edits are still here; retry saving to finish.` : message);
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (!draft || saving || !canManage) return;
    try {
      // Check the whole draft before anything is sent.
      userEditChanges(user, draft, membershipTypes);
      setError(null);
      if (draft.role !== user.role_access) setPendingRole(draft.role);
      else void save();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the form and try again.");
    }
  };

  const name = formatUserName(user);
  const photoUrl = displayedPhotoUrl(user.profile_photo_path, draft?.photo);
  const tierName = user.membership_type_name ? formatMembershipTypeName(user.membership_type_name) : null;
  const schoolEditable = draft !== null && canEditUserSchool(user, draft.fields.membership_type_id, membershipTypes);
  const verifiedBy =
    user.ubc_verified_by === currentUserId
      ? "you"
      : user.ubc_verified_by === record.ubc_verified_by && verifierName
        ? verifierName
        : "a former or unavailable manager";
  const ubcVerified = isUbcVerifiedNow(user, membershipTermEndsAt);
  const verification = ubcVerificationLine({
    user,
    termEndsAt: membershipTermEndsAt,
    verifiedBy,
    // The code row was read with the record; a save since may have moved on.
    codeSentAt: user.ubc_verified_at === record.ubc_verified_at ? ubcCodeSentAt : null,
  });

  const textField = (field: UserEditField, label: string, value: ReactNode, props: ComponentProps<typeof Input> = {}) => (
    <RecordField label={label} value={value} htmlFor={id(field)}>
      {draft ? (
        <Input
          id={id(field)}
          value={draft.fields[field]}
          disabled={saving}
          onChange={(event) => setField(field, event.target.value)}
          {...props}
        />
      ) : undefined}
    </RecordField>
  );

  return (
    <>
      <RecordView
        title={name}
        titleAdornment={
          <>
            {ubcVerified ? (
              <span className="inline-flex text-primary" title="UBC verified">
                <BadgeCheck className="size-4" aria-hidden />
                <span className="sr-only">UBC verified</span>
              </span>
            ) : null}
            {user.preferred_pronouns ? (
              <span className="text-small text-muted-foreground">{user.preferred_pronouns}</span>
            ) : null}
          </>
        }
        subtitle={user.created_at ? `User since ${formatEventDate(user.created_at)}` : undefined}
        media={<Avatar key={photoUrl ?? "none"} name={name} src={photoUrl} size={64} decorative />}
        status={
          tierName ? <Badge variant="info">{tierName}</Badge> : <Badge variant="neutral">No membership</Badge>
        }
        actions={
          canManage ? (
            <Button type="button" variant="secondary" size="sm" onClick={startEditing}>
              <Pencil aria-hidden />
              Edit user
            </Button>
          ) : undefined
        }
        editing={editing}
        dirty={dirty}
        saving={saving}
        error={pendingRole === null ? error : null}
        onCancel={cancel}
        onSave={requestSave}
        details={
          <>
            <RecordSection title="Profile">
              {draft ? (
                <>
                  {textField("first_name", "First name", user.first_name, { autoComplete: "off" })}
                  {textField("last_name", "Last name", user.last_name, { autoComplete: "off" })}
                  <UserAvatarField
                    name={name}
                    photoUrl={photoUrl}
                    disabled={saving}
                    onChange={(photo) => update({ photo })}
                  />
                </>
              ) : null}
              <RecordField label="Birthday" value={formatBirthDate(user.birth_date)} htmlFor={id("birthday")}>
                {draft ? (
                  <Input
                    id={id("birthday")}
                    type="date"
                    value={draft.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    disabled={saving}
                    onChange={(event) => update({ birthDate: event.target.value })}
                  />
                ) : undefined}
              </RecordField>
              <UserInterestsField value={user.interests} draft={draft ?? undefined} disabled={saving} onChange={update} />
            </RecordSection>

            <RecordSection title="Contact">
              {textField("email", "Email", user.email, { type: "email", autoComplete: "off" })}
              {textField("phone", "Phone", user.phone, { type: "tel", autoComplete: "off" })}
              <RecordField label="Newsletter" value={user.newsletter ? "Subscribed" : "Not subscribed"}>
                {draft ? (
                  <div className="flex min-h-10 items-center gap-2">
                    <Checkbox
                      id={id("newsletter")}
                      checked={draft.fields.newsletter === "true"}
                      disabled={saving}
                      onCheckedChange={(checked) => setField("newsletter", String(checked))}
                    />
                    <Label htmlFor={id("newsletter")}>Subscribed to the newsletter</Label>
                  </div>
                ) : undefined}
              </RecordField>
            </RecordSection>

            <RecordSection title="Membership">
              <RecordField label="Tier" value={tierName ?? "No membership"} htmlFor={id("tier")}>
                {draft ? (
                  <MembershipTypeField
                    id={id("tier")}
                    value={draft.fields.membership_type_id}
                    currentId={user.membership_type_id}
                    currentName={user.membership_type_name}
                    membershipTypes={membershipTypes}
                    disabled={saving}
                    onValueChange={(value) => setField("membership_type_id", value)}
                  />
                ) : undefined}
              </RecordField>
              {schoolEditable ? (
                textField("school_institution", "School", null, { autoComplete: "off" })
              ) : (
                <RecordField
                  label="School"
                  editing={false}
                  value={editing ? displaySchool(user, null) : displaySchool(user)}
                  description={editing ? SCHOOL_LOCKED : undefined}
                />
              )}
              {textField("student_number", "Student number", user.student_number?.toString(), { inputMode: "numeric", autoComplete: "off" })}
              <RecordField label="UBC email" editing={false} value={user.ubc_email} />
              <RecordField label="Verification" value={verification}>
                {draft ? (
                  <div className="flex min-h-10 items-center gap-2">
                    <Checkbox
                      id={id("verified")}
                      checked={draft.verified}
                      disabled={saving}
                      onCheckedChange={(verified) => update({ verified })}
                    />
                    <Label htmlFor={id("verified")}>Verified</Label>
                  </div>
                ) : undefined}
              </RecordField>
              {textField("faculty", "Faculty", user.faculty, { autoComplete: "off" })}
              {textField("major", "Area of study", user.major, { autoComplete: "off" })}
              <RecordField label="Year" value={user.year} htmlFor={id("year")}>
                {draft ? (
                  <Select
                    value={draft.fields.year || NO_YEAR}
                    disabled={saving}
                    onValueChange={(value) => setField("year", value === NO_YEAR ? "" : value)}
                  >
                    <SelectTrigger id={id("year")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_YEAR}>Not set</SelectItem>
                      {YEARS.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : undefined}
              </RecordField>
            </RecordSection>

            <RecordSection title="Access">
              <RecordField
                label="Role"
                value={roleLabel(user.role_access)}
                htmlFor={id("role")}
                description={editing && user.id === currentUserId ? "This is your account. Your access changes as soon as you save." : undefined}
              >
                {draft ? (
                  <Select
                    value={draft.role}
                    disabled={saving}
                    onValueChange={(role) => update({ role: role as RoleAccess })}
                  >
                    <SelectTrigger id={id("role")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : undefined}
              </RecordField>
              <RecordField
                label="Auth user ID"
                editing={false}
                value={user.auth_user_id ? <CopyCode code={user.auth_user_id} label="Copy auth user ID" /> : null}
              />
            </RecordSection>

            <RecordSection title="Recent transactions" kind="content">
              {transactions}
            </RecordSection>
          </>
        }
      />
      <ConfirmDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRole(null);
            setError(null);
          }
        }}
        title="Change role access?"
        description={
          pendingRole
            ? `Change ${name} from ${roleLabel(user.role_access)} to ${roleLabel(pendingRole)}?`
            : "Confirm this role change."
        }
        confirmLabel="Change role"
        pendingLabel="Changing role..."
        confirmVariant={pendingRole === "basic" ? "destructive" : "default"}
        error={pendingRole !== null ? error : null}
        pending={saving}
        onConfirm={() => void save()}
      />
    </>
  );
}
