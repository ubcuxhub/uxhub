"use client";

import { useState } from "react";

import {
  MembershipDetailsForm,
  type MembershipDetailsClient,
} from "@/features/memberships/components/MembershipDetailsForm";
import {
  UbcCodeStep,
  type UbcCodeState,
  type UbcCodeStatus,
} from "@/features/memberships/components/UbcCodeStep";
import type { UbcSendResult, UbcVerifyResult } from "@/features/memberships/lib/ubc-verification";
import type { UserInfoRow } from "@/lib/supabase/models";

/**
 * The join details step's UBC code states (docs/design/ubc-email-verification.md,
 * "Dialog UX") on fixture data, in a frame shaped like the membership dialog.
 * The server is an in-memory fake that waits 600ms per call: "123456" is the
 * right code, anything else is wrong, and Resend always sends.
 */

const EMAIL = "jane@student.ubc.ca";
const wait = () => new Promise((resolve) => setTimeout(resolve, 600));
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).getTime();

function fakeClient(): MembershipDetailsClient {
  let attemptsLeft = 5;
  return {
    saveProfile: async (input) => {
      await wait();
      if (input.audience === "non-ubc") return { ok: true, verification: "verified" };
      attemptsLeft = 5;
      return {
        ok: true,
        verification: "code",
        email: input.ubcEmail.trim().toLowerCase(),
        send: {
          status: "sent",
          resendAt: new Date(later(60)).toISOString(),
          expiresAt: new Date(later(600)).toISOString(),
        },
      };
    },
    sendCode: async (): Promise<UbcSendResult> => {
      await wait();
      attemptsLeft = 5;
      return {
        status: "sent",
        resendAt: new Date(later(60)).toISOString(),
        expiresAt: new Date(later(600)).toISOString(),
      };
    },
    verifyCode: async (code): Promise<UbcVerifyResult> => {
      await wait();
      if (code === "123456") return { status: "verified" };
      attemptsLeft -= 1;
      return attemptsLeft > 0 ? { status: "wrong", attemptsLeft } : { status: "locked" };
    },
  };
}

const STUDENT = {
  id: "fixture-student",
  email: "jane.lee@gmail.com",
  first_name: "Jane",
  last_name: "Lee",
  user_type: "ubcStudent",
  user_type_confirmed_at: "2026-09-01T16:00:00.000Z",
  student_number: 38475610,
  faculty: "Faculty of Arts",
  year: "3",
  major: "Cognitive Systems",
  faculty_email: null,
  school_institution: null,
  student_status: null,
  ubc_email: null,
  ubc_verified_at: null,
  ubc_verified_via: null,
  ubc_verified_by: null,
  membership_type_id: null,
  membership_expires_at: null,
  membership_pre_ordered_type_id: null,
} as unknown as UserInfoRow;

const FACULTY = {
  ...STUDENT,
  email: "prof.lee@cs.ubc.ca",
  user_type: "faculty",
  student_number: null,
  major: null,
  year: null,
} as unknown as UserInfoRow;

type CodeScenario = { status: UbcCodeStatus; attemptsLeft?: number; resend?: number; expires?: number | null };

export const UBC_CODE_SCENARIOS = {
  "ubc-details": null,
  "ubc-details-signin": null,
  "ubc-code-sent": { status: "code_sent", resend: 42 },
  "ubc-code-wrong": { status: "wrong", attemptsLeft: 3, resend: 0 },
  "ubc-code-expired": { status: "expired", expires: -1, resend: 0 },
  "ubc-code-locked": { status: "locked", attemptsLeft: 0, resend: 0 },
  "ubc-code-daily-cap": { status: "daily_cap" },
  "ubc-code-taken": { status: "taken" },
  "ubc-code-send-failed": { status: "send_failed", expires: null },
  "ubc-code-verified": { status: "verified" },
} satisfies Record<string, CodeScenario | null>;

export type UbcCodeScenarioId = keyof typeof UBC_CODE_SCENARIOS;

function codeState(scenario: CodeScenario): UbcCodeState {
  return {
    status: scenario.status,
    attemptsLeft: scenario.attemptsLeft ?? 5,
    resendAt: scenario.resend === undefined ? null : later(scenario.resend),
    expiresAt: scenario.expires === null ? null : later(scenario.expires ?? 540),
  };
}

function ContinuedNote() {
  return (
    <p className="mt-4 text-small text-muted-foreground">
      (Here the real step continues to tiers and payment.)
    </p>
  );
}

/** A frame the size of the membership dialog's content. */
function DialogFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[640px] items-start justify-center bg-scrim p-4 sm:p-10">
      <div className="flex min-h-[520px] w-full max-w-lg flex-col rounded-xl bg-background p-5 pt-16 shadow-lg sm:p-6 sm:pt-16">
        {children}
      </div>
    </div>
  );
}

export function UbcCodeTemplate({ scenario }: { scenario: UbcCodeScenarioId }) {
  const [client] = useState(fakeClient);
  const [verified, setVerified] = useState(false);
  const code = UBC_CODE_SCENARIOS[scenario];

  if (code === null) {
    const signIn = scenario === "ubc-details-signin";
    return (
      <DialogFrame>
        <MembershipDetailsForm
          audience={signIn ? "faculty" : "student"}
          client={client}
          onContinue={() => setVerified(true)}
          user={signIn ? FACULTY : STUDENT}
          ubc={{ signInEmail: signIn ? "prof.lee@cs.ubc.ca" : null, pending: null }}
        />
        {verified ? <ContinuedNote /> : null}
      </DialogFrame>
    );
  }

  return (
    <DialogFrame>
      <UbcCodeStep
        client={client}
        email={EMAIL}
        start={{ kind: "send", result: { status: "sent", resendAt: new Date(later(60)).toISOString(), expiresAt: new Date(later(600)).toISOString() } }}
        initialState={codeState(code)}
        onChangeEmail={() => undefined}
        onVerified={() => setVerified(true)}
      />
      {verified ? <ContinuedNote /> : null}
    </DialogFrame>
  );
}
