"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { updateEligibilityProfileAction } from "@/features/memberships/actions";
import { canEditMembershipClassification } from "@/features/memberships/lib/policy";
import { validateStudentNumber } from "@/features/memberships/lib/validation";
import type { UserInfoRow } from "@/types/models";
import {
  ProfileFields,
  type ProfileFormData,
} from "./ProfileFields";

const supabase = createClient();

const emptyForm: ProfileFormData = {
  name: "",
  preferred_pronouns: "",
  phone: "",
  student_number: "",
  user_type: "ubcStudent",
  faculty: "",
  faculty_email: "",
  major: "",
  school_institution: "",
  student_status: "",
  year: "",
  dietary_restrictions: "",
};

function toFormData(user: UserInfoRow): ProfileFormData {
  return {
    name: user.name || "",
    preferred_pronouns: user.preferred_pronouns || "",
    phone: user.phone || "",
    student_number: user.student_number?.toString() || "",
    user_type: user.user_type,
    faculty: user.faculty || "",
    faculty_email: user.faculty_email || "",
    major: user.major || "",
    school_institution: user.school_institution || "",
    student_status: user.student_status || "",
    year: user.year || "",
    dietary_restrictions: user.dietary_restrictions || "",
  };
}

export function ProfileSettings() {
  const { user, membershipTermEndsAt, refreshUser } = useUser();
  const [formData, setFormData] = useState<ProfileFormData>(emptyForm);
  const [membershipName, setMembershipName] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canEditEligibility = user
    ? canEditMembershipClassification(user, membershipTermEndsAt)
    : false;
  // Only complain once they have actually changed it — an account that never
  // had a student number should not open on a red field.
  const studentNumberError =
    user?.user_type === "ubcStudent" &&
    canEditEligibility &&
    formData.student_number !== (user.student_number?.toString() ?? "")
      ? validateStudentNumber(formData.student_number)
      : null;

  useEffect(() => {
    if (user) queueMicrotask(() => setFormData(toFormData(user)));
  }, [user]);

  useEffect(() => {
    if (!user?.membership_type_id) {
      queueMicrotask(() => setMembershipName(null));
      return;
    }
    fetchMembershipTypeById(supabase, user.membership_type_id)
      .then((membership) => setMembershipName(membership?.name ?? null))
      .catch(() => setMembershipName(null));
  }, [user?.membership_type_id]);

  const handleSaveCallback = useCallback(async () => {
    if (!user) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const studentNumber = formData.student_number
        ? parseInt(formData.student_number)
        : null;
      if (
        formData.user_type !== user.user_type ||
        studentNumber !== user.student_number
      ) {
        await updateEligibilityProfileAction({
          userType: formData.user_type,
          studentNumber: formData.student_number || null,
          faculty: formData.faculty || null,
          facultyEmail:
            formData.user_type === "faculty" ? user.email : null,
        });
      }
      await updateUserInfoById(supabase, user.id, {
        name: formData.name,
        preferred_pronouns: formData.preferred_pronouns || null,
        phone: formData.phone || null,
        faculty: formData.faculty || null,
        major: formData.major || null,
        year: formData.year || null,
        dietary_restrictions: formData.dietary_restrictions || null,
      });
      await refreshUser();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      // The eligibility action rejects duplicate or malformed student numbers
      // with a message worth showing verbatim.
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save — check your connection.",
      );
      setSaveStatus("error");
    }
  }, [formData, user, refreshUser]);

  useEffect(() => {
    // Nothing edited yet (first render, or a refresh echoing our own write):
    // stay quiet rather than firing a write and flashing "Saved".
    if (!user) return;
    const saved = toFormData(user);
    const dirty = (Object.keys(saved) as Array<keyof ProfileFormData>).some(
      (key) => formData[key] !== saved[key],
    );
    if (!dirty) return;
    // Hold the write while a field is mid-edit and invalid; the inline error
    // under the field says why nothing is saving.
    if (studentNumberError) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => handleSaveCallback(), 800);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [formData, user, studentNumberError, handleSaveCallback]);

  if (!user) return null;

  const patch = (values: Partial<ProfileFormData>) =>
    setFormData((current) => ({ ...current, ...values }));

  // A pre-order is pending, not nothing: it locks the eligibility fields the
  // same way an active membership does, so the status has to say so or the
  // lock note beside "Not a member" reads as a bug.
  const membershipStatus = user.membership_pre_ordered_type_id
    ? "Pending — payment processing"
    : user.membership_type_id
      ? membershipName
        ? `${membershipName} member`
        : "Member"
      : "Not a member";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-small text-muted-foreground">
          Changes save automatically.
        </p>
        <SaveStatus status={saveStatus} error={saveError} />
      </div>
      <ProfileFields
        user={user}
        formData={formData}
        membershipStatus={membershipStatus}
        membershipTermEndsAt={membershipTermEndsAt}
        canEditEligibility={canEditEligibility}
        studentNumberError={studentNumberError}
        patch={patch}
      />
    </div>
  );
}

function SaveStatus({
  status,
  error,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
}) {
  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-1.5 text-small ${
        status === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {status === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Saving…
        </>
      ) : status === "saved" ? (
        <>
          <Check className="size-3.5" />
          Saved
        </>
      ) : status === "error" ? (
        <>
          <CircleAlert className="size-3.5 shrink-0" />
          {error ?? "Couldn't save — check your connection."}
        </>
      ) : null}
    </p>
  );
}
