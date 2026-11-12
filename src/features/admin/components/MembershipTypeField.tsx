"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import type { MembershipTypeOption } from "../types";

const NONE = "__none__";

interface MembershipTypeFieldProps {
  id: string;
  /** The draft tier id; empty for no membership. */
  value: string;
  /** The saved tier, offered (disabled) when it is no longer active. */
  currentId: string | null | undefined;
  currentName: string | null | undefined;
  /** Active tiers. */
  membershipTypes: MembershipTypeOption[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}

/** The tier picker in a user record. Inactive tiers can be kept but not chosen. */
export function MembershipTypeField({
  id,
  value,
  currentId,
  currentName,
  membershipTypes,
  disabled,
  onValueChange,
}: MembershipTypeFieldProps) {
  const inactive = currentId && !membershipTypes.some((tier) => tier.id === currentId);
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onValueChange(next === NONE ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select membership type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>None</SelectItem>
        {inactive ? (
          <SelectItem value={currentId} disabled>
            {currentName ? formatMembershipTypeName(currentName) : "Inactive membership"}
          </SelectItem>
        ) : null}
        {membershipTypes.map((tier) => (
          <SelectItem key={tier.id} value={tier.id}>
            {formatMembershipTypeName(tier.name)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
