"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MembershipTypeOption } from "../types/userManagementTypes";

interface MembershipTypeFieldProps {
  value: string | null | undefined;
  selectedMembershipTypeId: string | null | undefined;
  isEditing: boolean;
  editValue: string;
  membershipTypes: MembershipTypeOption[];
  isSaving: boolean;
  onEditStart: (field: string, currentValue: string | number | boolean | null) => void;
  onEditCancel: () => void;
  onEditSave: (field: string) => void;
  onValueChange: (value: string) => void;
}

export function MembershipTypeField({
  value,
  selectedMembershipTypeId,
  isEditing,
  editValue,
  membershipTypes,
  isSaving,
  onEditStart,
  onEditCancel,
  onEditSave,
  onValueChange,
}: MembershipTypeFieldProps) {
  return (
    <div className="space-y-2">
      <Label>Membership Type</Label>
      {isEditing ? (
        <div className="flex gap-2">
          <Select value={editValue} onValueChange={onValueChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select membership type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {membershipTypes.map((membershipType) => (
                <SelectItem key={membershipType.id} value={membershipType.id}>
                  {membershipType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => onEditSave("membership_type_id")}
            disabled={isSaving}
          >
            Save
          </Button>
          <Button variant="outline" onClick={onEditCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-small">
          <span className={!value ? "text-muted-foreground" : ""}>{value || "None"}</span>
          <Button
            variant="ghost"
            onClick={() => onEditStart("membership_type_id", selectedMembershipTypeId ?? null)}
            className="h-6 px-2"
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
