"use client";

import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { createAutosave, type Autosave } from "@/features/applications/lib/autosave";
import { canEditMembershipClassification } from "@/features/memberships/lib/policy";
import type { AvatarChoice } from "@/features/setup/components/AvatarPicker";
import { toDietaryValue, type DietaryValue } from "@/features/setup/components/DietaryFields";
import { pickInterestIds } from "@/features/setup/components/InterestFields";
import type { AvatarPreset, InterestId } from "@/features/setup/lib/options";
import type { DietaryNeeds } from "@/features/setup/lib/validation";
import { useUser } from "@/lib/auth/user-context";
import type { UserInfoRow } from "@/lib/supabase/models";

import { createServerProfileClient, type ProfileClient } from "./profile/client";
import {
  ABOUT_FIELDS,
  avatarChoiceOf,
  dietaryPayload,
  interestsPayload,
  membershipSummary,
  photoPayload,
  pickFields,
  profileErrors,
  sameFields,
  savedDietaryOf,
  sectionBlocked,
  sectionOf,
  STUDIES_FIELDS,
  toProfileForm,
  type AboutValues,
  type CheckedField,
  type ProfileFormData,
  type ProfileSaveStates,
  type ProfileSectionId,
  type SavedDietary,
  type StudiesValues,
} from "./profile/model";
import { ProfileTab } from "./profile/ProfileTab";

/** How long a change waits for the next one before it saves. */
const AUTOSAVE_MS = 800;

interface ProfileSettingsProps {
  /** Called after each change the server accepted; not on a failed or skipped save. */
  onSaved?: () => void;
}

/** Settings › Profile for the signed-in member. */
export function ProfileSettings({ onSaved }: ProfileSettingsProps = {}) {
  const { user, membershipTermEndsAt, refreshUser } = useUser();
  const [client] = useState(createServerProfileClient);
  // A refresh that briefly can't read the row mustn't unmount the editor
  // (and drop what's being typed): keep the last row until a new one lands.
  const [lastUser, setLastUser] = useState(user);
  if (user && user !== lastUser) setLastUser(user);
  const shown = user ?? lastUser;

  if (!shown) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading your profile" />
      </div>
    );
  }

  return (
    <ProfileEditor
      key={shown.id}
      user={shown}
      membershipTermEndsAt={membershipTermEndsAt}
      refreshUser={refreshUser}
      onSaved={onSaved}
      client={client}
    />
  );
}

interface ProfileEditorProps {
  /** The stored row. Refreshed after each save; the edits in progress stay put. */
  user: UserInfoRow;
  membershipTermEndsAt: string | null;
  refreshUser: () => Promise<void>;
  /** Called after each change the server accepted; not on a failed or skipped save. */
  onSaved?: () => void;
  client: ProfileClient;
  /** The debounce and the waits before retrying a failed save (tests shorten them). */
  timing?: { delayMs?: number; retryDelaysMs?: readonly number[] };
}

type Payloads = {
  about: AboutValues;
  studies: StudiesValues;
  dietary: DietaryNeeds;
  interests: InterestId[];
  photo: AvatarPreset;
};

type SectionAutosaves = { [K in ProfileSectionId]: Autosave<Payloads[K]> };

/**
 * The Profile tab wired to a member's row: each section autosaves on its own
 * (`createAutosave`, as the application form does), so a section saving,
 * failing or held by an invalid field never touches the others' status.
 */
export function ProfileEditor({
  user,
  membershipTermEndsAt,
  refreshUser,
  onSaved,
  client,
  timing,
}: ProfileEditorProps) {
  const canEditEligibility = canEditMembershipClassification(user, membershipTermEndsAt);

  const [initial] = useState(() => {
    const dietary = savedDietaryOf(user);
    return {
      form: toProfileForm(user),
      savedDietary: dietary,
      dietary: toDietaryValue(dietary.needs, dietary.answered),
      interests: pickInterestIds(user.interests),
      choice: avatarChoiceOf(user),
    };
  });
  const [form, setForm] = useState<ProfileFormData>(initial.form);
  const [touched, setTouched] = useState<ReadonlySet<CheckedField>>(() => new Set());
  const [dietary, setDietary] = useState<DietaryValue>(initial.dietary);
  const [interests, setInterests] = useState<InterestId[]>(initial.interests);
  const [choice, setChoice] = useState<AvatarChoice>(initial.choice);
  const [photoPath, setPhotoPath] = useState(user.profile_photo_path);
  const [savedStudentNumber, setSavedStudentNumber] = useState(initial.form.student_number);
  const [saveStates, setSaveStates] = useState<ProfileSaveStates>({});
  const [membershipName, setMembershipName] = useState<string | null>(null);
  const [delays] = useState(timing);

  // What the inputs hold now, and what is stored: the autosave timers read
  // these after the render that scheduled them.
  const current = useRef({
    form: initial.form,
    dietary: initial.dietary,
    interests: initial.interests,
    choice: initial.choice,
  });
  const saved = useRef<{
    about: AboutValues;
    studies: StudiesValues;
    dietary: SavedDietary;
    interests: InterestId[];
    preset: AvatarPreset | null;
    photoPath: string | null;
  }>({
    about: pickFields(initial.form, ABOUT_FIELDS),
    studies: pickFields(initial.form, STUDIES_FIELDS[user.user_type]),
    dietary: initial.savedDietary,
    interests: initial.interests,
    preset: initial.choice?.kind === "preset" ? initial.choice.preset : null,
    photoPath: user.profile_photo_path,
  });
  const context = useRef({ user, client, refreshUser, onSaved, canEditEligibility });
  useEffect(() => {
    context.current = { user, client, refreshUser, onSaved, canEditEligibility };
  });

  const autosaves = useRef<SectionAutosaves | null>(null);
  useEffect(() => {
    const options = {
      delayMs: delays?.delayMs ?? AUTOSAVE_MS,
      retryDelaysMs: delays?.retryDelaysMs,
    };
    const report = (section: ProfileSectionId) => (state: ProfileSaveStates[ProfileSectionId]) =>
      setSaveStates((states) => ({ ...states, [section]: state }));
    // The rest of the app (sidebar avatar, membership pages) reads the row,
    // and the dialog refreshes server-rendered pages once it closes.
    const refresh = () => {
      context.current.refreshUser().catch(() => {});
      context.current.onSaved?.();
    };
    const blocked = (section: "about" | "studies") =>
      sectionBlocked(
        section,
        profileErrors(current.current.form, {
          userType: context.current.user.user_type,
          canEditEligibility: context.current.canEditEligibility,
          savedStudentNumber: saved.current.studies.student_number ?? "",
        }),
      );

    const created: SectionAutosaves = {
      about: createAutosave<AboutValues>({
        ...options,
        onState: report("about"),
        read: () => {
          if (blocked("about")) return null;
          const values = pickFields(current.current.form, ABOUT_FIELDS);
          return sameFields(values, saved.current.about) ? null : values;
        },
        // The details and the birthday take different paths; each is sent
        // only when it changed, and a half-done save remembers the half.
        write: async (values) => {
          const { birth_date: birthDate, ...details } = values;
          const { birth_date: savedBirthDate, ...savedDetails } = saved.current.about;
          if (!sameFields(details, savedDetails)) {
            await context.current.client.saveAbout(context.current.user, details);
            saved.current.about = { ...details, birth_date: savedBirthDate };
          }
          if (birthDate !== savedBirthDate) {
            await context.current.client.saveBirthDate(birthDate || null);
          }
          saved.current.about = values;
          refresh();
          return "saved";
        },
      }),
      studies: createAutosave<StudiesValues>({
        ...options,
        onState: report("studies"),
        read: () => {
          if (blocked("studies")) return null;
          const values = pickFields(current.current.form, STUDIES_FIELDS[context.current.user.user_type]);
          return sameFields(values, saved.current.studies) ? null : values;
        },
        write: async (values) => {
          const numberChanged =
            (values.student_number ?? "") !== (saved.current.studies.student_number ?? "");
          await context.current.client.saveStudies(context.current.user, values, numberChanged);
          saved.current.studies = values;
          setSavedStudentNumber(values.student_number ?? "");
          refresh();
          return "saved";
        },
      }),
      dietary: createAutosave<DietaryNeeds>({
        ...options,
        onState: report("dietary"),
        read: () => dietaryPayload(current.current.dietary, saved.current.dietary),
        write: async (needs) => {
          await context.current.client.saveDietary(needs);
          saved.current.dietary = { needs, answered: true };
          refresh();
          return "saved";
        },
      }),
      interests: createAutosave<InterestId[]>({
        ...options,
        onState: report("interests"),
        read: () => interestsPayload(current.current.interests, saved.current.interests),
        write: async (chosen) => {
          await context.current.client.saveInterests(chosen);
          saved.current.interests = chosen;
          refresh();
          return "saved";
        },
      }),
      // A picked icon is a choice, not typing: it saves at once.
      photo: createAutosave<AvatarPreset>({
        ...options,
        delayMs: 0,
        onState: report("photo"),
        read: () => photoPayload(current.current.choice, saved.current.preset),
        write: async (preset) => {
          const setup = await context.current.client.savePreset(preset);
          saved.current.preset = preset;
          saved.current.photoPath = setup.profilePhotoPath;
          setPhotoPath(setup.profilePhotoPath);
          // The icon replaced the uploaded photo. If "Your photo" was picked
          // again meanwhile, it no longer exists: show the icon that's stored.
          if (!setup.profilePhotoPath && current.current.choice?.kind === "photo") {
            const stored: AvatarChoice = { kind: "preset", preset };
            current.current.choice = stored;
            setChoice(stored);
          }
          refresh();
          return "saved";
        },
      }),
    };
    autosaves.current = created;
    return () => {
      autosaves.current = null;
      // Closing the dialog mid-debounce still saves what was changed.
      for (const autosave of Object.values(created)) void autosave.flush();
    };
  }, [delays]);

  useEffect(() => {
    const id = user.membership_type_id;
    if (!id) return;
    let live = true;
    client.membershipName(id).then(
      (name) => {
        if (live) setMembershipName(name);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [client, user.membership_type_id]);

  const schedule = (section: ProfileSectionId) => autosaves.current?.[section].schedule();

  const onFormChange = (patch: Partial<ProfileFormData>) => {
    const next = { ...current.current.form, ...patch };
    current.current.form = next;
    setForm(next);
    const sections = new Set(
      (Object.keys(patch) as Array<keyof ProfileFormData>).map(sectionOf),
    );
    sections.forEach(schedule);
  };

  const onDietaryChange = (next: DietaryValue) => {
    current.current.dietary = next;
    setDietary(next);
    schedule("dietary");
  };

  const onInterestsChange = (next: InterestId[]) => {
    current.current.interests = next;
    setInterests(next);
    schedule("interests");
  };

  const onAvatarChoiceChange = (next: AvatarChoice) => {
    current.current.choice = next;
    setChoice(next);
    schedule("photo");
  };

  // Uploading reports in the photo panel's status like a picked icon does.
  // A refused upload rethrows, so the crop dialog stays open with its message.
  const onUpload = async (photo: Blob) => {
    const photoAutosave = autosaves.current?.photo;
    if (!photoAutosave) throw new Error("The profile is closing.");
    setSaveStates((states) => ({ ...states, photo: { kind: "saving" } }));
    try {
      const setup = await photoAutosave.exclusive(() =>
        context.current.client.uploadPhoto(photo, saved.current.photoPath),
      );
      saved.current.photoPath = setup.profilePhotoPath;
      saved.current.preset = setup.avatarPreset;
      const uploaded: AvatarChoice = { kind: "photo" };
      current.current.choice = uploaded;
      setChoice(uploaded);
      setPhotoPath(setup.profilePhotoPath);
      setSaveStates((states) => ({ ...states, photo: { kind: "saved", at: Date.now() } }));
      context.current.refreshUser().catch(() => {});
      context.current.onSaved?.();
    } catch (error) {
      setSaveStates((states) => ({ ...states, photo: photoAutosave.state() }));
      throw error;
    }
  };

  const errors = profileErrors(form, {
    userType: user.user_type,
    canEditEligibility,
    savedStudentNumber,
  });

  return (
    <ProfileTab
      user={user}
      membership={membershipSummary(user, membershipName, membershipTermEndsAt)}
      photoUrl={client.photoUrl(photoPath)}
      form={form}
      onFormChange={onFormChange}
      onFieldBlur={(field) =>
        setTouched((fields) => (fields.has(field) ? fields : new Set(fields).add(field)))
      }
      errors={{
        first_name: touched.has("first_name") ? errors.first_name : null,
        last_name: touched.has("last_name") ? errors.last_name : null,
        student_number: touched.has("student_number") ? errors.student_number : null,
        birth_date: touched.has("birth_date") ? errors.birth_date : null,
      }}
      canEditEligibility={canEditEligibility}
      avatarChoice={choice}
      onAvatarChoiceChange={onAvatarChoiceChange}
      onUpload={onUpload}
      dietary={dietary}
      onDietaryChange={onDietaryChange}
      interests={interests}
      onInterestsChange={onInterestsChange}
      saveStates={saveStates}
      onRetry={(section) => autosaves.current?.[section].retry()}
    />
  );
}
