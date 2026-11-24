import { updateEligibilityProfileAction } from "@/features/memberships/actions";
import {
  saveBirthDateAction,
  saveSetupDietaryAction,
  saveSetupPhotoAction,
} from "@/features/setup/actions";
import { profilePhotoUrl, uploadProfilePhoto } from "@/features/setup/components/setup-client";
import type { AvatarPreset, InterestId } from "@/features/setup/lib/options";
import type { SetupState } from "@/features/setup/lib/state";
import type { DietaryNeeds } from "@/features/setup/lib/validation";
import { createClient } from "@/lib/supabase/client";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import type { UserInfoRow, UserInfoUpdate } from "@/lib/supabase/models";

import { saveInterestsAction } from "../../actions";
import type { AboutDetails, StudiesValues } from "./model";

/**
 * Everything the Profile tab sends to the server, behind one interface so
 * tests can run the real tab on fixture data. Every method throws on failure.
 * These are the paths the tab has always used: the member's own row through
 * RLS for plain details, and the server actions (which authorize from the
 * session) for eligibility, setup answers, the birthday and interests.
 */
export interface ProfileClient {
  saveAbout: (user: UserInfoRow, values: AboutDetails) => Promise<void>;
  /** Saves or clears the birthday through setup's action, as setup step 1 does. */
  saveBirthDate: (birthDate: string | null) => Promise<SetupState>;
  /** `studentNumberChanged` routes the number through the eligibility action. */
  saveStudies: (
    user: UserInfoRow,
    values: StudiesValues,
    studentNumberChanged: boolean,
  ) => Promise<void>;
  saveDietary: (needs: DietaryNeeds) => Promise<SetupState>;
  savePreset: (preset: AvatarPreset) => Promise<SetupState>;
  saveInterests: (interests: InterestId[]) => Promise<SetupState>;
  /** Throws `PhotoUploadError` with copy for the crop dialog. */
  uploadPhoto: (photo: Blob, expectedPath: string | null) => Promise<SetupState>;
  photoUrl: (path: string | null) => string | null;
  membershipName: (membershipTypeId: string) => Promise<string | null>;
}

const orNull = (value: string | undefined) => value?.trim() || null;

export function aboutUpdate(values: AboutDetails): UserInfoUpdate {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    preferred_pronouns: orNull(values.preferred_pronouns),
    phone: orNull(values.phone),
  };
}

/**
 * The plain studies columns for the member's account type. The student
 * number never goes this way: the eligibility action validates it and
 * refuses while a membership is active or pending.
 */
export function studiesUpdate(userType: UserInfoRow["user_type"], values: StudiesValues): UserInfoUpdate {
  if (userType === "ubcStudent") {
    return {
      faculty: orNull(values.faculty),
      major: orNull(values.major),
      year: values.year || null,
    };
  }
  if (userType === "faculty") return { faculty: orNull(values.faculty) };
  return {
    school_institution: orNull(values.school_institution),
    student_status: values.student_status || null,
    year: values.year || null,
  };
}

export function createServerProfileClient(): ProfileClient {
  const supabase = createClient();
  return {
    saveAbout: (user, values) => updateUserInfoById(supabase, user.id, aboutUpdate(values)),
    async saveStudies(user, values, studentNumberChanged) {
      if (studentNumberChanged) {
        await updateEligibilityProfileAction({
          userType: user.user_type,
          studentNumber: values.student_number?.trim() || null,
          faculty: orNull(values.faculty),
          facultyEmail: user.user_type === "faculty" ? user.email : null,
        });
      }
      await updateUserInfoById(supabase, user.id, studiesUpdate(user.user_type, values));
    },
    saveBirthDate: (birthDate) => saveBirthDateAction({ birthDate }),
    saveDietary: saveSetupDietaryAction,
    savePreset: (preset) => saveSetupPhotoAction({ avatarPreset: preset }),
    saveInterests: (interests) => saveInterestsAction({ interests }),
    uploadPhoto: uploadProfilePhoto,
    photoUrl: profilePhotoUrl,
    membershipName: async (id) => (await fetchMembershipTypeById(supabase, id))?.name ?? null,
  };
}
