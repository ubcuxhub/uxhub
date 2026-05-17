"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EditableUserField } from "./EditableUserField";
import { MembershipTypeField } from "./MembershipTypeField";
import type {
  MembershipTypeOption,
  UserRecord,
} from "../types/userManagementTypes";

interface UserDetailsPanelProps {
  selectedUser: UserRecord | null;
  editingField: string | null;
  editValue: string;
  isSaving: boolean;
  membershipTypes: MembershipTypeOption[];
  onEditStart: (field: string, currentValue: string | number | boolean | null) => void;
  onEditCancel: () => void;
  onEditSave: (field: string) => void;
  onValueChange: (value: string) => void;
}

export function UserDetailsPanel({
  selectedUser,
  editingField,
  editValue,
  isSaving,
  membershipTypes,
  onEditStart,
  onEditCancel,
  onEditSave,
  onValueChange,
}: UserDetailsPanelProps) {
  if (!selectedUser) {
    return (
      <div className="w-1/2 overflow-y-auto p-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No user selected</p>
            <p className="text-sm">
              Select a user from the directory to view and edit their information
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
          <h2 className="text-2xl font-semibold mb-2">User Details</h2>
          <p className="text-sm text-muted-foreground">
            View and edit user information
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableUserField
              label="Name"
              field="name"
              value={selectedUser.name}
              isEditing={editingField === "name"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
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
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableUserField
              label="Role Access"
              field="role_access"
              value={selectedUser.role_access}
              isEditing={editingField === "role_access"}
              editValue={editValue}
              isSaving={isSaving}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onValueChange={onValueChange}
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Auth User ID</Label>
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                {selectedUser.auth_user_id}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
