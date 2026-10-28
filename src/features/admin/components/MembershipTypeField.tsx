"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import type { MembershipTypeOption } from "../types";
import { UserDetailField, UserDetailValue } from "./UserDetailField";

interface MembershipTypeFieldProps {
  value: string | null | undefined;
  selectedMembershipTypeId: string | null | undefined;
  membershipTypes: MembershipTypeOption[];
  isSaving: boolean;
  editValue?: string;
  onValueChange: (value: string) => void;
  canEdit: boolean;
}

export function MembershipTypeField({ value, selectedMembershipTypeId, membershipTypes, isSaving, editValue, onValueChange, canEdit }: MembershipTypeFieldProps) {
  const id = useId();
  return (
    <UserDetailField label="Membership Type" htmlFor={canEdit ? id : undefined}>
      {canEdit ? <>
        <Select value={editValue || "__none__"} onValueChange={(value) => onValueChange(value === "__none__" ? "" : value)} disabled={isSaving}>
          <SelectTrigger id={id} className="text-small"><SelectValue placeholder="Select membership type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {selectedMembershipTypeId && !membershipTypes.some((tier) => tier.id === selectedMembershipTypeId) && (
              <SelectItem value={selectedMembershipTypeId} disabled>{value ? formatMembershipTypeName(value) : "Inactive membership"}</SelectItem>
            )}
            {membershipTypes.map((tier) => <SelectItem key={tier.id} value={tier.id}>{formatMembershipTypeName(tier.name)}</SelectItem>)}
          </SelectContent>
        </Select>
      </> : <UserDetailValue>
        <span className={!value ? "text-muted-foreground" : ""}>{value ? formatMembershipTypeName(value) : "None"}</span>
      </UserDetailValue>}
    </UserDetailField>
  );
}
