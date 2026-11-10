"use client";

import { useState } from "react";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { SetupFlow, type SetupView } from "@/features/setup/components/SetupFlow";
import type { SetupClient } from "@/features/setup/components/setup-client";
import { nextSetupStep, type SetupState } from "@/features/setup/lib/state";

/**
 * Member setup (`/portal/setup`) on fixture data: the real screens and crop
 * dialog, with the server swapped for an in-memory fake that waits 600ms per
 * write, so the button progress shows. Uploads stay in the browser as object
 * URLs.
 */

const FIXTURE: SetupState = {
  step: "dietary",
  diets: [],
  allergies: [],
  otherAllergies: [],
  avatarPreset: null,
  profilePhotoPath: null,
  interests: [],
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 600));

function fakeClient(): SetupClient {
  let state = FIXTURE;
  const write = async (patch: Partial<SetupState>) => {
    await wait();
    state = { ...state, ...patch };
    return state;
  };
  return {
    saveDietary: (needs) => write({ ...needs, step: nextSetupStep(state.step, "dietary") }),
    savePhoto: ({ avatarPreset }) =>
      write({
        avatarPreset,
        profilePhotoPath: avatarPreset ? null : state.profilePhotoPath,
        step: nextSetupStep(state.step, "photo"),
      }),
    finish: ({ interests }) => write({ interests, step: "done" }),
    skip: (step) => write({ step: nextSetupStep(state.step, step) }),
    uploadPhoto: (photo) => write({ profilePhotoPath: URL.createObjectURL(photo), avatarPreset: null }),
    // The fake stores the object URL as the "path".
    photoUrl: (path) => path,
  };
}

export const SETUP_TEMPLATE_STARTS: Record<string, SetupView> = {
  "setup-dietary": "dietary",
  "setup-photo": "photo",
  "setup-interests": "interests",
  "setup-welcome": "welcome",
};

export function SetupTemplate({ start }: { start: SetupView }) {
  const [client] = useState(fakeClient);
  return (
    <AuthShell>
      <SetupFlow
        key={start}
        initial={{ ...FIXTURE, step: start === "welcome" ? "done" : start }}
        name="Jamie Lee"
        firstName="Jamie"
        client={client}
        homeHref="/dev/templates"
        startAt={start}
      />
    </AuthShell>
  );
}
