"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Receipt, SlidersHorizontal, User, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import type { AutosaveState } from "@/features/applications/lib/autosave";
import { validateStudentNumber } from "@/features/memberships/lib/validation";
import type { ProfileFormData } from "@/features/settings/components/ProfileFields";
import {
  membershipSummary,
  type ProfileSaveStates,
  type ProfileSectionId,
} from "@/features/settings/components/profile-redesign/model";
import { ProfileTab } from "@/features/settings/components/profile-redesign/ProfileTab";
import type { AvatarChoice } from "@/features/setup/components/AvatarPicker";
import { toDietaryValue, type DietaryValue } from "@/features/setup/components/DietaryFields";
import type { AvatarPreset, InterestId } from "@/features/setup/lib/options";
import type { UserInfoRow } from "@/lib/supabase/models";

/**
 * The proposed Profile tab (docs/design/profile-settings.md) on fixture data,
 * in a static copy of the Settings dialog's chrome. Saving is faked: a change
 * waits 800ms (the real debounce), then "saves" for 600ms.
 */

const TERM_ENDS_AT = "2027-08-31T23:59:00-07:00";

const BASE: UserInfoRow = {
  id: "fixture-user",
  auth_user_id: "fixture-auth",
  email: "maya.chen@student.ubc.ca",
  first_name: "Maya",
  last_name: "Chen",
  preferred_pronouns: "she/her",
  phone: "604 555 0134",
  user_type: "ubcStudent",
  faculty: "Faculty of Science",
  faculty_email: null,
  major: "Cognitive Systems",
  year: "3",
  student_number: 31415926,
  school_institution: null,
  student_status: null,
  role_access: "basic",
  membership_type_id: "innovator",
  membership_pre_ordered_type_id: null,
  membership_expires_at: "2027-09-14T12:00:00-07:00",
  created_at: "2025-09-03T12:00:00-07:00",
  updated_at: null,
  deleted_at: null,
  setup_step: "done",
  diets: ["vegetarian"],
  allergies: ["tree-nuts"],
  other_allergies: ["Sesame"],
  interests: ["ux-research", "design-systems", "accessibility", "workshops", "portfolio-reviews", "mentorship"],
  avatar_preset: null,
  profile_photo_path: "/people/cherry.jpg",
  newsletter: true,
  birth_date: null,
  dietary_restrictions: null,
  order_date_deprecated: null,
  square_customer_id: null,
  student_verified_at: null,
  student_verified_by: null,
};

/** Signed up a minute ago and skipped setup: only the sign-up fields are set. */
const NEW_MEMBER: UserInfoRow = {
  ...BASE,
  email: "sam.okafor@student.ubc.ca",
  first_name: "Sam",
  last_name: "Okafor",
  preferred_pronouns: null,
  phone: null,
  faculty: null,
  major: null,
  year: null,
  student_number: null,
  membership_type_id: null,
  membership_expires_at: null,
  created_at: "2026-11-09T09:00:00-08:00",
  setup_step: "dietary",
  diets: [],
  allergies: [],
  other_allergies: [],
  interests: [],
  profile_photo_path: null,
};

/** An admin with a preset avatar, mid-save. */
const ADMIN: UserInfoRow = {
  ...BASE,
  email: "priya.natarajan@ubcuxhub.ca",
  first_name: "Priya",
  last_name: "Natarajan",
  preferred_pronouns: "she/they",
  role_access: "admin",
  profile_photo_path: null,
  avatar_preset: "flower",
  diets: ["halal"],
  allergies: [],
  other_allergies: [],
};

/** Not a member yet, so the student number is still editable. */
const NON_MEMBER: UserInfoRow = {
  ...BASE,
  email: "leo.martin@student.ubc.ca",
  first_name: "Leo",
  last_name: "Martin",
  preferred_pronouns: null,
  membership_type_id: null,
  membership_expires_at: null,
  profile_photo_path: null,
  avatar_preset: "sparkle",
  student_number: null,
};

interface Scenario {
  user: UserInfoRow;
  membershipName: string | null;
  /** Form values that differ from the saved row (an edit in progress). */
  edits?: Partial<ProfileFormData>;
  saveStates?: ProfileSaveStates;
  /** Fields whose errors show from the start, as if just left. */
  touched?: Array<"first_name" | "last_name" | "student_number">;
  photoOpen?: boolean;
}

export const PROFILE_SCENARIOS = {
  "profile-filled": { user: BASE, membershipName: "Innovator" },
  "profile-new": { user: NEW_MEMBER, membershipName: null },
  "profile-saving": {
    user: ADMIN,
    membershipName: "Innovator",
    saveStates: {
      about: { kind: "saved", at: Date.parse("2026-11-09T14:41:00-08:00") },
      dietary: { kind: "saving" },
    },
    photoOpen: true,
  },
  "profile-error": {
    user: NON_MEMBER,
    membershipName: null,
    edits: { phone: "604 555 0199", student_number: "1234567" },
    saveStates: { about: { kind: "failed" } },
    touched: ["student_number"],
  },
} satisfies Record<string, Scenario>;

export type ProfileScenarioId = keyof typeof PROFILE_SCENARIOS;

const DEBOUNCE_MS = 800;
const SAVE_MS = 600;

function toForm(user: UserInfoRow): ProfileFormData {
  return {
    first_name: user.first_name,
    last_name: user.last_name,
    preferred_pronouns: user.preferred_pronouns ?? "",
    phone: user.phone ?? "",
    student_number: user.student_number?.toString() ?? "",
    user_type: user.user_type,
    faculty: user.faculty ?? "",
    faculty_email: user.faculty_email ?? "",
    major: user.major ?? "",
    school_institution: user.school_institution ?? "",
    student_status: user.student_status ?? "",
    year: user.year ?? "",
  };
}

const ABOUT_FIELDS = new Set<keyof ProfileFormData>(["first_name", "last_name", "preferred_pronouns", "phone"]);

/** The in-memory autosave: one debounce timer per section, like the real tab. */
function useFakeAutosave(initial: ProfileSaveStates) {
  const [states, setStates] = useState<ProfileSaveStates>(initial);
  const timers = useRef(new Map<ProfileSectionId, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const set = (section: ProfileSectionId, state: AutosaveState) =>
    setStates((current) => ({ ...current, [section]: state }));

  const save = (section: ProfileSectionId, delay: number) => {
    clearTimeout(timers.current.get(section));
    set(section, { kind: "pending" });
    timers.current.set(
      section,
      setTimeout(() => {
        set(section, { kind: "saving" });
        timers.current.set(
          section,
          setTimeout(() => set(section, { kind: "saved", at: Date.now() }), SAVE_MS),
        );
      }, delay),
    );
  };

  return {
    states,
    schedule: (section: ProfileSectionId) => save(section, DEBOUNCE_MS),
    retry: (section: ProfileSectionId) => save(section, 0),
    /** A change that can't save yet (an invalid field) stops the pending save. */
    hold: (section: ProfileSectionId) => {
      clearTimeout(timers.current.get(section));
      setStates((current) =>
        current[section]?.kind === "pending" ? { ...current, [section]: { kind: "idle" } } : current,
      );
    },
  };
}

export function ProfileTemplate({ scenario }: { scenario: ProfileScenarioId }) {
  const config: Scenario = PROFILE_SCENARIOS[scenario];
  const { user } = config;

  const [form, setForm] = useState<ProfileFormData>(() => ({ ...toForm(user), ...config.edits }));
  const [touched, setTouched] = useState(() => new Set(config.touched ?? []));
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.profile_photo_path);
  const [choice, setChoice] = useState<AvatarChoice>(() =>
    user.profile_photo_path
      ? { kind: "photo" }
      : user.avatar_preset
        ? { kind: "preset", preset: user.avatar_preset as AvatarPreset }
        : null,
  );
  const [dietary, setDietary] = useState<DietaryValue>(() =>
    toDietaryValue(
      {
        diets: user.diets as DietaryValue["diets"],
        allergies: user.allergies as DietaryValue["allergies"],
        otherAllergies: user.other_allergies,
      },
      user.setup_step === "done",
    ),
  );
  const [interests, setInterests] = useState<InterestId[]>(user.interests as InterestId[]);
  const autosave = useFakeAutosave(config.saveStates ?? {});

  const canEditEligibility = !user.membership_type_id && !user.membership_pre_ordered_type_id;
  const errorsFor = (values: ProfileFormData) => ({
    first_name: values.first_name.trim() ? null : "Enter your first name.",
    last_name: values.last_name.trim() ? null : "Enter your last name.",
    student_number:
      canEditEligibility && values.student_number !== (user.student_number?.toString() ?? "")
        ? validateStudentNumber(values.student_number)
        : null,
  });
  const errors = errorsFor(form);
  const shown = {
    first_name: touched.has("first_name") ? errors.first_name : null,
    last_name: touched.has("last_name") ? errors.last_name : null,
    student_number: touched.has("student_number") ? errors.student_number : null,
  };

  return (
    <SettingsFrame>
      <ProfileTab
        user={user}
        membership={membershipSummary(user, config.membershipName, TERM_ENDS_AT)}
        photoUrl={photoUrl}
        form={form}
        onFormChange={(patch) => {
          const next = { ...form, ...patch };
          setForm(next);
          const nextErrors = errorsFor(next);
          const section = Object.keys(patch).some((key) => ABOUT_FIELDS.has(key as keyof ProfileFormData))
            ? "about"
            : "studies";
          const blocked =
            section === "about"
              ? nextErrors.first_name || nextErrors.last_name
              : nextErrors.student_number;
          if (blocked) autosave.hold(section);
          else autosave.schedule(section);
        }}
        onFieldBlur={(field) => setTouched((current) => new Set(current).add(field))}
        errors={shown}
        canEditEligibility={canEditEligibility}
        avatarChoice={choice}
        onAvatarChoiceChange={(next) => {
          setChoice(next);
          if (next?.kind === "preset") autosave.retry("photo");
        }}
        onUpload={async (photo) => {
          await new Promise((resolve) => setTimeout(resolve, SAVE_MS));
          setPhotoUrl(URL.createObjectURL(photo));
          setChoice({ kind: "photo" });
          autosave.retry("photo");
        }}
        dietary={dietary}
        onDietaryChange={(next) => {
          setDietary(next);
          // Typing in Other allergies isn't a change until it's added.
          if (next.pending === dietary.pending) autosave.schedule("dietary");
        }}
        interests={interests}
        onInterestsChange={(next) => {
          setInterests(next);
          autosave.schedule("interests");
        }}
        saveStates={autosave.states}
        onRetry={autosave.retry}
        defaultPhotoOpen={config.photoOpen}
      />
    </SettingsFrame>
  );
}

const TABS = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "profile", label: "Profile", icon: User },
  { id: "purchases", label: "Purchase history", icon: Receipt },
] as const;

/**
 * A static copy of `SettingsDialog`'s chrome (sidebar, title, close), sized
 * like `DialogContent size="large"`: full screen on phones, 1000 by 760 from
 * `sm`. The tabs and close don't navigate.
 */
function SettingsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="sm:bg-section sm:p-6">
      <div className="relative mx-auto flex h-dvh w-full max-w-[1000px] overflow-hidden bg-popover text-popover-foreground sm:h-[760px] sm:rounded-2xl sm:border sm:shadow-overlay">
        <SidebarProvider className="h-full min-h-0 w-full">
          <Sidebar collapsible="none" className="hidden w-48 bg-transparent sm:flex">
            <SidebarContent className="pt-8">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {TABS.map((tab) => (
                      <SidebarMenuItem key={tab.id}>
                        <SidebarMenuButton isActive={tab.id === "profile"}>
                          <tab.icon />
                          <span>{tab.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex shrink-0 items-center gap-2 px-4 py-4 pr-14 sm:px-6 sm:py-6 sm:pr-16">
              <IconButton label="Back to settings" variant="ghost" className="-ml-2 sm:hidden">
                <ArrowLeft />
              </IconButton>
              <h2 className="text-subheading">Profile</h2>
            </header>
            <div className="flex-1 overflow-y-auto px-4 pt-1 pb-8 sm:px-6">{children}</div>
          </main>
        </SidebarProvider>
        <IconButton
          label="Close"
          variant="ghost"
          className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground"
        >
          <X />
        </IconButton>
      </div>
    </div>
  );
}
