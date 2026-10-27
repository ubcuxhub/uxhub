"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { UserEditField } from "../lib/user-edit";

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
  return (
    <div className="flex flex-col gap-2">
      {typeof value === "boolean" ? (
        <Label htmlFor={id} className="flex items-center gap-2 text-small font-normal">
          <Checkbox id={id} checked={canEdit ? editValue === "true" : value} disabled={!canEdit || isSaving}
            onCheckedChange={(checked) => onValueChange(field, String(checked))} />
          {label}
        </Label>
      ) : <>
        <Label htmlFor={canEdit ? id : undefined} className="text-body font-medium">{label}</Label>
        {canEdit ? (
          <Input id={id} className="text-small" value={editValue ?? ""} disabled={isSaving} onChange={(event) => onValueChange(field, event.target.value)} />
        ) : <div className="rounded-md border border-input bg-background px-3 py-2 text-small">
          <span className={value == null || value === "" ? "text-muted-foreground" : ""}>{value == null || value === "" ? "—" : String(value)}</span>
        </div>}
      </>}
    </div>
  );
}
