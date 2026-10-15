"use client";

import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTimestamp } from "@/lib/date";
import { UserProfileSection } from "./UserProfileSection";
import type { RoleAccess, UserInfoRow } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";
import type { MembershipTypeOption, UserRecord } from "../types";
import { EditableUserField } from "./EditableUserField";
import { MembershipTypeField } from "./MembershipTypeField";
import { UserRecentTransactions } from "./UserRecentTransactions";

interface UserDetailsPanelProps {
  selectedUser: UserRecord;
  verifierName?: string;
  onProfileUpdate: (user: UserInfoRow) => void;
  onBusy: (busy: boolean) => void;
  editingField: string | null;
  editValue: string;
  isSaving: boolean;
  membershipTypes: MembershipTypeOption[];
  canManageUsers: boolean;
  editMode: boolean;
  headerAction?: ReactNode;
  onEditStart: (field: string, currentValue: string | number | boolean | null) => void;
  onEditCancel: () => void;
  onEditSave: (field: string) => void;
  onValueChange: (value: string) => void;
  onRoleChangeRequest: (role: RoleAccess) => void;
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border border-input bg-background px-3 py-2 text-small">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export function UserDetailsPanel({
  selectedUser,
  verifierName,
  onProfileUpdate,
  onBusy,
  editingField,
  editValue,
  isSaving,
  membershipTypes,
  canManageUsers,
  editMode,
  headerAction,
  onEditStart,
  onEditCancel,
  onEditSave,
  onValueChange,
  onRoleChangeRequest,
}: UserDetailsPanelProps) {
  const canEdit = canManageUsers && editMode;
  const profileProps = { user: selectedUser, verifierName, canEdit, busy: isSaving, onBusy, onUpdate: onProfileUpdate };
  const fieldProps = {
    editValue,
    isSaving,
    onEditStart,
    onEditCancel,
    onEditSave,
    onValueChange,
    canEdit,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <UserProfileSection section="photo" {...profileProps}>
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
                value={selectedUser[field]} isEditing={editingField === field} />
            ))}
          </div>
          {([
            ["email", "Email"],
            ["phone", "Phone Number"],
          ] as const).map(([field, label]) => (
            <EditableUserField key={field} {...fieldProps} field={field} label={label}
              value={selectedUser[field]} isEditing={editingField === field} />
          ))}
          <UserProfileSection section="verification" {...profileProps} />
          <EditableUserField {...fieldProps} field="newsletter" label="Newsletter Opt-In"
            value={selectedUser.newsletter} isEditing={editingField === "newsletter"} />
          <MembershipTypeField
            {...fieldProps}
            value={selectedUser.membership_type_name}
            selectedMembershipTypeId={selectedUser.membership_type_id}
            isEditing={editingField === "membership_type_id"}
            membershipTypes={membershipTypes}
          />
          <ReadOnlyField label="School" value={selectedUser.school_institution} />
          <EditableUserField {...fieldProps} field="major" label="Area of Study"
            value={selectedUser.major} isEditing={editingField === "major"} />
          <UserProfileSection section="birthday" {...profileProps} />
          <UserRecentTransactions key={selectedUser.id} userId={selectedUser.id} />
          <UserProfileSection section="interests" {...profileProps} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {([
            ["student_number", "Student Number"],
            ["faculty", "Faculty"],
            ["year", "Year"],
            ["order_date", "Order Date"],
          ] as const).map(([field, label]) => (
            <EditableUserField key={field} {...fieldProps} field={field} label={label}
              value={selectedUser[field]} isEditing={editingField === field} />
          ))}
          <div className="space-y-2">
            <Label>Role Access</Label>
            {canEdit ? (
              <Select value={selectedUser.role_access}
                onValueChange={(role) => onRoleChangeRequest(role as RoleAccess)} disabled={isSaving}>
                <SelectTrigger aria-label="Role Access"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-input bg-background px-3 py-2 text-small capitalize">
                {selectedUser.role_access}
              </div>
            )}
          </div>
          <ReadOnlyField label="Auth User ID" value={selectedUser.auth_user_id} />
        </CardContent>
      </Card>
    </div>
  );
}
