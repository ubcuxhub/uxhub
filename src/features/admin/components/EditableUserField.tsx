"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { UserEditField } from "../lib/user-edit";
import { UserDetailField, UserDetailValue } from "./UserDetailField";

interface EditableUserFieldProps {
  label: string;
  field: UserEditField;
  value: string | number | boolean | null | undefined;
  editValue?: string;
  isSaving: boolean;
  onValueChange: (field: UserEditField, value: string) => void;
  canEdit: boolean;
}

export function EditableUserField({ label, field, value, editValue, isSaving, onValueChange, canEdit }: EditableUserFieldProps) {
  const id = useId();
  if (typeof value === "boolean") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="flex items-center gap-2">
          <Checkbox id={id} checked={canEdit ? editValue === "true" : value} disabled={!canEdit || isSaving}
            onCheckedChange={(checked) => onValueChange(field, String(checked))} />
          {label}
        </Label>
      </div>
    );
  }

  return (
    <UserDetailField label={label} htmlFor={canEdit ? id : undefined}>
      {canEdit ? (
        <Input id={id} value={editValue ?? ""} disabled={isSaving} onChange={(event) => onValueChange(field, event.target.value)} />
      ) : <UserDetailValue>
        <span className={value == null || value === "" ? "text-muted-foreground" : ""}>{value == null || value === "" ? "—" : String(value)}</span>
      </UserDetailValue>}
    </UserDetailField>
  );
}
