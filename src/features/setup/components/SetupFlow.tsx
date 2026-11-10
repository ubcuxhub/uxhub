"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Hubbo } from "@/components/shared/Hubbo";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { AuthPanel } from "@/features/auth/components/AuthPanel";

import { SETUP_STEPS, type InterestId, type SetupStepId } from "../lib/options";
import type { SetupState } from "../lib/state";
import { AvatarPicker, type AvatarChoice } from "./AvatarPicker";
import {
  DietaryFields,
  isDietaryEmpty,
  resolveDietary,
  toDietaryValue,
  type DietaryValue,
} from "./DietaryFields";
import { InterestFields, pickInterestIds, selectedCountLabel } from "./InterestFields";
import { SAVE_FAILED, serverSetupClient, type SetupClient } from "./setup-client";

export type SetupView = SetupStepId | "welcome";

export const SETUP_COPY: Record<SetupStepId, { title: string; description: string }> = {
  dietary: {
    title: "Any dietary needs?",
    description:
      "The UX Hub team sees this so every event has food you can eat. Pick all that apply.",
  },
  photo: {
    title: "Choose a photo",
    description: "Pick an icon or upload your own. It shows on your profile.",
  },
  interests: {
    title: "What are you into?",
    description: "The UX Hub team sees your interests so we can plan events you'll enjoy.",
  },
};

export const NO_DIETARY_ANSWER =
  "Choose what applies to you, or “I don't have any dietary needs”. You can also skip for now.";
export const NO_PHOTO_CHOICE = "Choose an icon or upload a photo, or skip for now.";

export function stepLabel(step: SetupStepId): string {
  return `Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`;
}

/** Where a visit starts: the stored step, or step 1 for a member who finished and came back. */
export function initialView(state: SetupState): SetupView {
  return state.step === "done" ? "dietary" : state.step;
}

function initialChoice(state: SetupState): AvatarChoice {
  if (state.profilePhotoPath) return { kind: "photo" };
  if (state.avatarPreset) return { kind: "preset", preset: state.avatarPreset };
  return null;
}

interface SetupFlowProps {
  initial: SetupState;
  /** Full name, for the photo preview. */
  name: string;
  firstName: string;
  /** The server actions by default; dev templates and tests pass fakes. */
  client?: SetupClient;
  /** Where Welcome continues to. */
  homeHref?: string;
  /** Start on another screen (dev templates only). */
  startAt?: SetupView;
}

/**
 * Member setup at `/portal/setup` (review §4 and §7 #6–#9): dietary needs,
 * a photo and interests, then Welcome. Every step can be skipped; nothing
 * here gates registration or checkout.
 *
 * The step lives in component state, not the URL: a visit resumes at the
 * stored `setup_step`, and Back only moves between screens (it saves
 * nothing). On every change the new heading takes focus and a live region
 * reads the step, so screen-reader users hear where they are.
 */
export function SetupFlow({
  initial,
  name,
  firstName,
  client = serverSetupClient,
  homeHref = "/portal",
  startAt,
}: SetupFlowProps) {
  const [view, setView] = useState<SetupView>(startAt ?? initialView(initial));
  const [setup, setSetup] = useState(initial);
  const [dietary, setDietary] = useState<DietaryValue>(() =>
    toDietaryValue(initial, initial.step !== "dietary"),
  );
  const [choice, setChoice] = useState<AvatarChoice>(() => initialChoice(initial));
  const [interests, setInterests] = useState<InterestId[]>(() => pickInterestIds(initial.interests));
  const [pending, setPending] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  const go = (next: SetupView) => {
    setError(null);
    setView(next);
    setAnnouncement(
      next === "welcome" ? "Setup complete" : `${stepLabel(next)}: ${SETUP_COPY[next].title}`,
    );
  };

  /** Runs a server write, then moves on. Failures keep the member on the step. */
  const run = async (kind: "save" | "skip", write: () => Promise<SetupState>, next: SetupView) => {
    setPending(kind);
    setError(null);
    try {
      setSetup(await write());
      go(next);
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setPending(null);
    }
  };

  const busy = pending !== null;
  const nextOf = (step: SetupStepId): SetupView =>
    SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1] ?? "welcome";
  const skip = (step: SetupStepId) => run("skip", () => client.skip(step), nextOf(step));

  if (view === "welcome") {
    return (
      <AuthPanel
        size="wide"
        headingRef={headingRef}
        illustration={<Hubbo emotion="welcoming" size="hero" />}
        title={`Welcome to UX Hub, ${firstName}`}
        description="You're all set. You can change any of this later in Settings."
      >
        <LiveStatus text={announcement} />
        <Button asChild className="w-full sm:w-auto">
          <Link href={homeHref}>Go to your portal</Link>
        </Button>
      </AuthPanel>
    );
  }

  const back = view === "dietary" ? null : () => go(SETUP_STEPS[SETUP_STEPS.indexOf(view) - 1]);

  let body: ReactNode;
  let primaryLabel: string;
  let meta: ReactNode = null;
  let onSubmit: () => void;

  if (view === "dietary") {
    primaryLabel = "Save dietary needs";
    body = (
      <DietaryFields
        value={dietary}
        onChange={(value) => {
          setError(null);
          setDietary(value);
        }}
        disabled={busy}
      />
    );
    onSubmit = () => {
      const resolved = resolveDietary(dietary);
      if ("error" in resolved) return setError(resolved.error);
      if (!dietary.none && isDietaryEmpty(resolved.needs)) return setError(NO_DIETARY_ANSWER);
      setDietary({ ...dietary, ...resolved.needs, pending: "" });
      void run("save", () => client.saveDietary(resolved.needs), "photo");
    };
  } else if (view === "photo") {
    primaryLabel = "Use this photo";
    body = (
      <AvatarPicker
        name={name}
        choice={choice}
        onChoiceChange={(next) => {
          setError(null);
          setChoice(next);
        }}
        photoUrl={client.photoUrl(setup.profilePhotoPath)}
        onUpload={async (photo) => {
          const saved = await client.uploadPhoto(photo, setup.profilePhotoPath);
          setSetup(saved);
          setChoice({ kind: "photo" });
          setError(null);
        }}
        disabled={busy}
      />
    );
    onSubmit = () => {
      if (!choice) return setError(NO_PHOTO_CHOICE);
      const avatarPreset = choice.kind === "preset" ? choice.preset : null;
      void run("save", () => client.savePhoto({ avatarPreset }), "interests");
    };
  } else {
    primaryLabel = "Finish setup";
    meta = selectedCountLabel(interests.length);
    body = <InterestFields value={interests} onChange={setInterests} disabled={busy} />;
    onSubmit = () => void run("save", () => client.finish({ interests }), "welcome");
  }

  const copy = SETUP_COPY[view];

  return (
    <AuthPanel
      size="wide"
      headingRef={headingRef}
      stepLabel={stepLabel(view)}
      stepAction={
        back ? (
          <IconButton label="Back" variant="secondary" disabled={busy} onClick={back} className="lg:hidden">
            <ArrowLeft />
          </IconButton>
        ) : null
      }
      title={copy.title}
      description={copy.description}
    >
      <LiveStatus text={announcement} />
      <form
        noValidate
        aria-label={copy.title}
        className="flex flex-col gap-8"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!busy) onSubmit();
        }}
      >
        {body}

        {error ? (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-6 lg:flex-row lg:items-center lg:justify-between">
          {back ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={back} className="hidden lg:inline-flex">
              Back
            </Button>
          ) : null}
          <div className="flex flex-col gap-3 lg:ml-auto lg:flex-row lg:items-center lg:gap-2">
            {meta ? (
              <p aria-live="polite" className="text-small text-muted-foreground lg:mr-2">
                {meta}
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              loading={pending === "skip"}
              disabled={busy}
              onClick={() => skip(view)}
            >
              Skip for now
            </Button>
            <Button type="submit" loading={pending === "save"} disabled={busy}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </form>
    </AuthPanel>
  );
}

/** Polite, visually hidden: says which step just opened. */
function LiveStatus({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}
