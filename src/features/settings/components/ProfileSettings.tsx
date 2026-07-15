"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UniversityYear, UserType } from "@/types/models";

const supabase = createClient();

const USER_TYPES: Array<{ value: UserType; label: string }> = [
  { value: "ubcStudent", label: "UBC Student" },
  { value: "faculty", label: "Faculty" },
  { value: "nonUbc", label: "Non-UBC" },
];

type ProfileFormData = {
  name: string;
  preferred_pronouns: string;
  phone: string;
  student_number: string;
  user_type: UserType;
  faculty: string;
  major: string;
  year: UniversityYear | "";
  dietary_restrictions: string;
  newsletter: boolean;
};

const emptyForm: ProfileFormData = {
  name: "",
  preferred_pronouns: "",
  phone: "",
  student_number: "",
  user_type: "ubcStudent",
  faculty: "",
  major: "",
  year: "",
  dietary_restrictions: "",
  newsletter: false,
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export function ProfileSettings() {
  const { user, refreshUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>(emptyForm);
  const [membershipName, setMembershipName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || "",
      preferred_pronouns: user.preferred_pronouns || "",
      phone: user.phone || "",
      student_number: user.student_number?.toString() || "",
      user_type: user.user_type || "ubcStudent",
      faculty: user.faculty || "",
      major: user.major || "",
      year: user.year || "",
      dietary_restrictions: user.dietary_restrictions || "",
      newsletter: user.newsletter ?? false,
    });
  }, [user]);

  useEffect(() => {
    if (!user?.membership_type_id) {
      setMembershipName(null);
      return;
    }
    fetchMembershipTypeById(supabase, user.membership_type_id)
      .then((m) => setMembershipName(m?.name ?? null))
      .catch((e) => console.error("Error loading membership:", e));
  }, [user?.membership_type_id]);

  if (!user) return null;

  const patch = (values: Partial<ProfileFormData>) =>
    setFormData((prev) => ({ ...prev, ...values }));

  const handleCancel = () => {
    setFormData({
      name: user.name || "",
      preferred_pronouns: user.preferred_pronouns || "",
      phone: user.phone || "",
      student_number: user.student_number?.toString() || "",
      user_type: user.user_type || "ubcStudent",
      faculty: user.faculty || "",
      major: user.major || "",
      year: user.year || "",
      dietary_restrictions: user.dietary_restrictions || "",
      newsletter: user.newsletter ?? false,
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserInfoById(supabase, user.id, {
        name: formData.name,
        preferred_pronouns: formData.preferred_pronouns || null,
        phone: formData.phone || null,
        student_number: formData.student_number
          ? parseInt(formData.student_number)
          : null,
        user_type: formData.user_type,
        faculty: formData.faculty || null,
        major: formData.major || null,
        year: formData.year || null,
        dietary_restrictions: formData.dietary_restrictions || null,
        newsletter: formData.newsletter,
      });
      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const membershipStatus = user.membership_type_id
    ? membershipName
      ? `${membershipName} member`
      : "Member"
    : "Not a member";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {!isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={formData.name}
          display={user.name}
          editing={isEditing}
          onChange={(v) => patch({ name: v })}
        />
        <TextField
          label="Pronouns"
          value={formData.preferred_pronouns}
          display={user.preferred_pronouns}
          editing={isEditing}
          onChange={(v) => patch({ preferred_pronouns: v })}
          placeholder="e.g. she/her"
        />
        <TextField
          label="Phone"
          type="tel"
          value={formData.phone}
          display={user.phone}
          editing={isEditing}
          onChange={(v) => patch({ phone: v })}
        />
        <TextField
          label="Student number"
          type="number"
          value={formData.student_number}
          display={user.student_number?.toString() ?? null}
          editing={isEditing}
          onChange={(v) => patch({ student_number: v })}
        />

        <Row label="User type">
          {isEditing ? (
            <Select
              value={formData.user_type}
              onValueChange={(v: UserType) => patch({ user_type: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user type" />
              </SelectTrigger>
              <SelectContent>
                {USER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ReadValue>
              {USER_TYPES.find((t) => t.value === user.user_type)?.label ??
                user.user_type}
            </ReadValue>
          )}
        </Row>

        <Row label="Faculty">
          {isEditing ? (
            <Select
              value={formData.faculty}
              onValueChange={(v: string) => patch({ faculty: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a faculty" />
              </SelectTrigger>
              <SelectContent>
                {FACULTIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ReadValue>{user.faculty}</ReadValue>
          )}
        </Row>

        <TextField
          label="Major"
          value={formData.major}
          display={user.major}
          editing={isEditing}
          onChange={(v) => patch({ major: v })}
        />

        <Row label="Year">
          {isEditing ? (
            <Select
              value={formData.year}
              onValueChange={(v: UniversityYear) => patch({ year: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_LEVELS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ReadValue>{user.year}</ReadValue>
          )}
        </Row>

        <div className="sm:col-span-2">
          <TextField
            label="Dietary restrictions"
            value={formData.dietary_restrictions}
            display={user.dietary_restrictions}
            editing={isEditing}
            onChange={(v) => patch({ dietary_restrictions: v })}
            placeholder="e.g. Vegetarian"
          />
        </div>

        {/* Newsletter preference */}
        <Row label="Newsletter">
          {isEditing ? (
            <button
              type="button"
              role="switch"
              aria-checked={formData.newsletter}
              onClick={() => patch({ newsletter: !formData.newsletter })}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",
                formData.newsletter ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  formData.newsletter ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          ) : (
            <ReadValue>
              {user.newsletter ? "Subscribed" : "Not subscribed"}
            </ReadValue>
          )}
        </Row>
      </div>

      {/* Read-only account details */}
      <div className="space-y-4 border-t pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Row label="Email">
            <ReadValue>{user.email}</ReadValue>
          </Row>
          <Row label="Membership">
            <ReadValue>{membershipStatus}</ReadValue>
          </Row>
          <Row label="Membership expires">
            <ReadValue>
              {user.membership_expires_at
                ? formatDate(user.membership_expires_at)
                : "—"}
            </ReadValue>
          </Row>
          <Row label="Role">
            <ReadValue className="capitalize">{user.role_access}</ReadValue>
          </Row>
          <Row label="Joined">
            <ReadValue>{formatDate(user.created_at)}</ReadValue>
          </Row>
        </div>
      </div>
    </div>
  );
}

/** Label + control/value row. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isEmpty =
    children === null ||
    children === undefined ||
    children === "" ||
    (typeof children === "string" && children.trim() === "");
  return (
    <div
      className={cn("min-h-9 flex items-center text-sm font-medium", className)}
    >
      {isEmpty ? <span className="text-muted-foreground/60">—</span> : children}
    </div>
  );
}

/** A text field that swaps between an Input (editing) and a read-only value. */
function TextField({
  label,
  value,
  display,
  editing,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  display: string | null | undefined;
  editing: boolean;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Row label={label}>
      {editing ? (
        <Input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <ReadValue>{display}</ReadValue>
      )}
    </Row>
  );
}
