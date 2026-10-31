"use client";

import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { canEditUserSchool, type UserEditDraft, type UserEditField } from "../lib/user-edit";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTimestamp } from "@/lib/date";
import { UserProfileSection } from "./UserProfileSection";
import type { RoleAccess } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";
import type { MembershipTypeOption, UserRecord } from "../types";
import { displaySchool } from "../lib/directory";
import { EditableUserField } from "./EditableUserField";
import { MembershipTypeField } from "./MembershipTypeField";
import { UserRecentTransactions } from "./UserRecentTransactions";
import { UserDetailField, UserDetailValue } from "./UserDetailField";

interface UserDetailsPanelProps {
  selectedUser: UserRecord;
  verifierName?: string;
  draft: UserEditDraft | null;
  onDraftChange: (changes: Partial<UserEditDraft>) => void;
  isSaving: boolean;
  membershipTypes: MembershipTypeOption[];
  canManageUsers: boolean;
  editMode: boolean;
  headerAction?: ReactNode;
}

function ReadOnlyField({ label, value, lockedReason }: { label: string; value: string | null | undefined; lockedReason?: string }) {
  const id = useId();
  return (
    <UserDetailField label={label} htmlFor={lockedReason ? id : undefined}>
      {lockedReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input id={id} readOnly aria-disabled="true" value={value || "—"}
                className="cursor-not-allowed" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs" side="top">{lockedReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : <UserDetailValue>
        {value || <span className="text-muted-foreground">—</span>}
      </UserDetailValue>}
    </UserDetailField>
  );
}

export function UserDetailsPanel({
  selectedUser,
  verifierName,
  draft,
  onDraftChange,
  isSaving,
  membershipTypes,
  canManageUsers,
  editMode,
  headerAction,
}: UserDetailsPanelProps) {
  const canEdit = canManageUsers && editMode;
  const schoolEditable = canEditUserSchool(selectedUser, canEdit && draft ? draft.fields.membership_type_id : selectedUser.membership_type_id, membershipTypes);
  const profileProps = { user: selectedUser, verifierName, canEdit, busy: isSaving, draft, onDraftChange };
  const onValueChange = (field: UserEditField, value: string) => {
    if (!draft) return;
    onDraftChange({ fields: { ...draft.fields, [field]: value }, ...(field === "student_number" ? { verified: false } : {}) });
  };
  const fieldProps = { isSaving, onValueChange, canEdit };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <UserProfileSection key={`photo-${canEdit}`} section="photo" {...profileProps}>
            <div className="min-w-0 space-y-1">
              <CardTitle className="break-words">{formatUserName(selectedUser)}</CardTitle>
              <p className="text-small text-muted-foreground">{selectedUser.preferred_pronouns || "—"}</p>
              <p className="text-small text-muted-foreground">User since {formatTimestamp(selectedUser.created_at) ?? "—"}</p>
            </div>
          </UserProfileSection>
          {headerAction && <CardAction>{headerAction}</CardAction>}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["first_name", "First Name"],
              ["last_name", "Last Name"],
            ] as const).map(([field, label]) => (
              <EditableUserField key={field} {...fieldProps} field={field} label={label}
                value={selectedUser[field]} editValue={draft?.fields[field]} />
            ))}
          </div>
          {([
            ["email", "Email"],
            ["phone", "Phone Number"],
          ] as const).map(([field, label]) => (
            <EditableUserField key={field} {...fieldProps} field={field} label={label}
              value={selectedUser[field]} editValue={draft?.fields[field]} />
          ))}
          <UserProfileSection key={`verification-${canEdit}`} section="verification" {...profileProps} />
          <EditableUserField {...fieldProps} field="newsletter" label="Newsletter Opt-In"
            value={selectedUser.newsletter} editValue={draft?.fields.newsletter} />
          <MembershipTypeField
            isSaving={isSaving}
            canEdit={canEdit}
            editValue={draft?.fields.membership_type_id}
            onValueChange={(value) => onValueChange("membership_type_id", value)}
            value={selectedUser.membership_type_name}
            selectedMembershipTypeId={selectedUser.membership_type_id}
            membershipTypes={membershipTypes}
          />
          {schoolEditable ? (
            <EditableUserField {...fieldProps} field="school_institution" label="School"
              value={selectedUser.school_institution} editValue={draft?.fields.school_institution} />
          ) : <ReadOnlyField label="School" value={displaySchool(selectedUser, null)}
            lockedReason={canEdit ? "Only Non-UBC members can change their school. Select a Non-UBC membership to edit this field." : undefined} />}
          <EditableUserField {...fieldProps} field="major" label="Area of Study"
            value={selectedUser.major} editValue={draft?.fields.major} />
          <UserProfileSection key={`birthday-${canEdit}`} section="birthday" {...profileProps} />
          <UserRecentTransactions key={selectedUser.id} userId={selectedUser.id} />
          <UserProfileSection key={`interests-${canEdit}`} section="interests" {...profileProps} />
          {([
            ["student_number", "Student Number"],
            ["faculty", "Faculty"],
            ["year", "Year"],
          ] as const).map(([field, label]) => (
            <EditableUserField key={field} {...fieldProps} field={field} label={label}
              value={selectedUser[field]} editValue={draft?.fields[field]} />
          ))}
          <UserDetailField label="Role Access">
            {canEdit ? (
              <Select value={draft?.role ?? selectedUser.role_access}
                onValueChange={(role) => onDraftChange({ role: role as RoleAccess })} disabled={isSaving}>
                <SelectTrigger aria-label="Role Access"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <UserDetailValue className="capitalize">
                {selectedUser.role_access}
              </UserDetailValue>
            )}
          </UserDetailField>
          <ReadOnlyField label="Auth User ID" value={selectedUser.auth_user_id}
            lockedReason={canEdit ? "Auth User ID is assigned automatically and cannot be edited." : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
