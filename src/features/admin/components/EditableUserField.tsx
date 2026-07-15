"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditableUserFieldProps {
  label: string;
  field: string;
  value: string | number | boolean | null | undefined;
  isEditing: boolean;
  editValue: string;
  isSaving: boolean;
  onEditStart: (field: string, currentValue: string | number | boolean | null) => void;
  onEditCancel: () => void;
  onEditSave: (field: string) => void;
  onValueChange: (value: string) => void;
}

export function EditableUserField({
  label,
  field,
  value,
  isEditing,
  editValue,
  isSaving,
  onEditStart,
  onEditCancel,
  onEditSave,
  onValueChange,
}: EditableUserFieldProps) {
  const displayValue = value === null || value === undefined ? "—" : String(value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {isEditing ? (
        <div className="flex gap-2">
          <Input
            value={editValue}
            onChange={(e) => onValueChange(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button onClick={() => onEditSave(field)} disabled={isSaving}>
            Save
          </Button>
          <Button variant="outline" onClick={onEditCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
          <span className={!value ? "text-muted-foreground" : ""}>{displayValue}</span>
          <Button
            variant="ghost"
            onClick={() => onEditStart(field, value ?? null)}
            className="h-6 px-2 text-xs"
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
