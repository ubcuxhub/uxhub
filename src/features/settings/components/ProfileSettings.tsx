"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { updateEligibilityProfileAction } from "@/features/memberships/actions";
import { canEditMembershipClassification } from "@/features/memberships/lib/policy";
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
  newsletter: false,
};

export function ProfileSettings() {
  const { user, membershipTermEndsAt, refreshUser } = useUser();
  const [formData, setFormData] = useState<ProfileFormData>(emptyForm);
  const [membershipName, setMembershipName] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetForm = () => {
    if (!user) return;
    setFormData({
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
      newsletter: user.newsletter,
    });
  };

  useEffect(() => {
    if (user) queueMicrotask(resetForm);
    // Reset only when the context's user record changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        newsletter: formData.newsletter,
      });
      await refreshUser();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [formData, user, refreshUser]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => handleSaveCallback(), 800);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [formData, handleSaveCallback]);

  if (!user) return null;

  const patch = (values: Partial<ProfileFormData>) =>
    setFormData((current) => ({ ...current, ...values }));

  const membershipStatus = user.membership_type_id
    ? membershipName
      ? `${membershipName} member`
      : "Member"
    : "Not a member";
  const canChangeClassification = canEditMembershipClassification(
    user,
    membershipTermEndsAt,
  );

  return (
    <div className="space-y-6">
      <ProfileFields
        user={user}
        formData={formData}
        editing={true}
        membershipStatus={membershipStatus}
        membershipTermEndsAt={membershipTermEndsAt}
        canChangeClassification={canChangeClassification}
        patch={patch}
      />
    </div>
  );
}
