"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleAccess } from "@/types/models";
import type {
  MembershipTypeOption,
  UserRecord,
} from "../types/userManagementTypes";
import { EditableUserField } from "./EditableUserField";
import { MembershipTypeField } from "./MembershipTypeField";

interface UserDetailsPanelProps {
  selectedUser: UserRecord | null;
  editingField: string | null;
  editValue: string;
  isSaving: boolean;
  membershipTypes: MembershipTypeOption[];
  canManageUsers: boolean;
  onEditStart: (
    field: string,
    currentValue: string | number | boolean | null
  ) => void;
  onEditCancel: () => void;
  onEditSave: (field: string) => void;
  onValueChange: (value: string) => void;
  onRoleChangeRequest: (role: RoleAccess) => void;
}

export function UserDetailsPanel({
  selectedUser,
  editingField,
  editValue,
  isSaving,
  membershipTypes,
  canManageUsers,
  onEditStart,
  onEditCancel,
  onEditSave,
  onValueChange,
  onRoleChangeRequest,
}: UserDetailsPanelProps) {
  if (!selectedUser) {
    return (
      <div className="w-1/2 overflow-y-auto p-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p className="text-subheading mb-2">No user selected</p>
            <p className="text-small">
              Select a user from the directory to view their information
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-1/2 overflow-y-auto p-6">
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-h2">User Details</h2>
          <p className="text-small text-muted-foreground">
            {canManageUsers
              ? "View and edit user information"
              : "View user information"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableUserField
              label="First name"
              field="first_name"
              value={selectedUser.first_name}
              isEditing={editingField === "first_name"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Last name"
              field="last_name"
              value={selectedUser.last_name}
              isEditing={editingField === "last_name"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Email"
              field="email"
              value={selectedUser.email}
              isEditing={editingField === "email"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Phone"
              field="phone"
              value={selectedUser.phone}
              isEditing={editingField === "phone"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membership Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MembershipTypeField
              value={selectedUser.membership_type_name}
              selectedMembershipTypeId={selectedUser.membership_type_id}
              isEditing={editingField === "membership_type_id"}
              editValue={editValue}
              membershipTypes={membershipTypes}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Order Date"
              field="order_date"
              value={selectedUser.order_date}
              isEditing={editingField === "order_date"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Newsletter"
              field="newsletter"
              value={selectedUser.newsletter}
              isEditing={editingField === "newsletter"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableUserField
              label="Student Number"
              field="student_number"
              value={selectedUser.student_number}
              isEditing={editingField === "student_number"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Faculty"
              field="faculty"
              value={selectedUser.faculty}
              isEditing={editingField === "faculty"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Major"
              field="major"
              value={selectedUser.major}
              isEditing={editingField === "major"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
            <EditableUserField
              label="Year"
              field="year"
              value={selectedUser.year}
              isEditing={editingField === "year"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
              canEdit={canManageUsers}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Role Access</Label>
              {canManageUsers ? (
                <Select
                  value={selectedUser.role_access}
                  onValueChange={(role) =>
                    onRoleChangeRequest(role as RoleAccess)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
            <div className="space-y-2">
              <Label>Auth User ID</Label>
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-small text-muted-foreground">
                {selectedUser.auth_user_id}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
