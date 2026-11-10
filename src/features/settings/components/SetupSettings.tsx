"use client";

import { useEffect, useRef, useState } from "react";

import { saveSetupDietaryAction, saveSetupPhotoAction } from "@/features/setup/actions";
import { AvatarPicker, type AvatarChoice } from "@/features/setup/components/AvatarPicker";
import {
  DietaryFields,
  toDietaryValue,
  type DietaryValue,
} from "@/features/setup/components/DietaryFields";
import {
  InterestFields,
  pickInterestIds,
  selectedCountLabel,
} from "@/features/setup/components/InterestFields";
import { profilePhotoUrl, uploadProfilePhoto } from "@/features/setup/components/setup-client";
import type { AllergyId, AvatarPreset, DietId, InterestId } from "@/features/setup/lib/options";
import { toSetupStep } from "@/features/setup/lib/state";
import type { DietaryNeeds } from "@/features/setup/lib/validation";
import type { UserInfoRow } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";

import { saveInterestsAction } from "../actions";
import { SectionHeader } from "./ProfileFields";

/** Runs a save and reports it in the tab's "Saving… / Saved" line. */
export type TrackSave = (save: () => Promise<unknown>) => Promise<boolean>;

const AUTOSAVE_MS = 800;

interface SetupSettingsProps {
  user: UserInfoRow;
  track: TrackSave;
  /** Refetches the signed-in user after a write the tab didn't track. */
  refreshUser: () => Promise<void>;
}

function savedDietary(user: UserInfoRow): DietaryNeeds {
  return {
    diets: user.diets as DietId[],
    allergies: user.allergies as AllergyId[],
    otherAllergies: user.other_allergies,
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

const sameDietary = (a: DietaryNeeds, b: DietaryNeeds) =>
  sameList(a.diets, b.diets) &&
  sameList(a.allergies, b.allergies) &&
  sameList(a.otherAllergies, b.otherAllergies);

/** `track` changes identity on every refresh; the autosave timers read the latest one. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * The photo section of Settings' Profile tab: the same picker and crop dialog
 * as setup step 2, saved as soon as it changes.
 */
export function PhotoSettings({ user, track, refreshUser }: SetupSettingsProps) {
  const [choice, setChoice] = useState<AvatarChoice>(() =>
    user.profile_photo_path
      ? { kind: "photo" }
      : user.avatar_preset
        ? { kind: "preset", preset: user.avatar_preset as AvatarPreset }
        : null,
  );
  const photoUrl = profilePhotoUrl(user.profile_photo_path);

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Photo"
        description={
          photoUrl
            ? "Shown on your profile. Choosing an icon replaces your uploaded photo."
            : "Shown on your profile."
        }
      />
      <AvatarPicker
        preview={false}
        name={formatUserName(user) || user.email}
        choice={choice}
        photoUrl={photoUrl}
        onChoiceChange={(next) => {
          setChoice(next);
          // Your photo is already what shows; only a preset needs a write.
          if (next?.kind === "preset") {
            void track(() => saveSetupPhotoAction({ avatarPreset: next.preset }));
          }
        }}
        onUpload={async (photo) => {
          await uploadProfilePhoto(photo, user.profile_photo_path);
          setChoice({ kind: "photo" });
          await refreshUser();
        }}
      />
    </section>
  );
}

/** Dietary needs in Settings: setup step 1's fields, saved shortly after each change. */
export function DietarySettings({ user, track }: SetupSettingsProps) {
  const [value, setValue] = useState<DietaryValue>(() =>
    toDietaryValue(savedDietary(user), toSetupStep(user.setup_step) !== "dietary"),
  );
  const lastSaved = useRef<DietaryNeeds>(savedDietary(user));
  const trackRef = useLatest(track);

  useEffect(() => {
    const needs: DietaryNeeds = {
      diets: value.diets,
      allergies: value.allergies,
      otherAllergies: value.otherAllergies,
    };
    if (sameDietary(needs, lastSaved.current)) return;
    const timer = setTimeout(() => {
      const previous = lastSaved.current;
      // Claimed before the write, so a re-render mid-save can't send it twice.
      lastSaved.current = needs;
      void trackRef.current(() => saveSetupDietaryAction(needs)).then((ok) => {
        if (!ok) lastSaved.current = previous;
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [value.diets, value.allergies, value.otherAllergies, trackRef]);

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Dietary needs"
        description="The UX Hub team sees this so every event has food you can eat."
      />
      <DietaryFields value={value} onChange={setValue} />
    </section>
  );
}

/** Interests in Settings: setup step 3's chips, saved shortly after each change. */
export function InterestSettings({ user, track }: SetupSettingsProps) {
  const [value, setValue] = useState<InterestId[]>(() => pickInterestIds(user.interests));
  const lastSaved = useRef<InterestId[]>(pickInterestIds(user.interests));
  const trackRef = useLatest(track);

  useEffect(() => {
    if (sameList(value, lastSaved.current)) return;
    const timer = setTimeout(() => {
      const previous = lastSaved.current;
      lastSaved.current = value;
      void trackRef.current(() => saveInterestsAction({ interests: value })).then((ok) => {
        if (!ok) lastSaved.current = previous;
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [value, trackRef]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <SectionHeader
          title="Interests"
          description="The UX Hub team sees these so we can plan events you'll enjoy."
        />
        <p aria-live="polite" className="shrink-0 text-small text-muted-foreground">
          {selectedCountLabel(value.length)}
        </p>
      </div>
      <InterestFields value={value} onChange={setValue} />
    </section>
  );
}
