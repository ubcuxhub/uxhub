import "server-only";

import { sendEmail } from "@/lib/email/client";
import { renderUbcVerificationCodeEmail } from "@/lib/email/templates";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  beginUbcCodeAttempt,
  claimUbcCodeSend,
  completeUbcCodeVerification,
} from "@/lib/supabase-helpers/ubc-verification";
import {
  generateUbcCode,
  hashUbcCode,
  newUbcCodeSalt,
  ubcCodeHashesMatch,
} from "./lib/ubc-code";
import {
  normalizeUbcCodeInput,
  UBC_CODE_TTL_MINUTES,
  type UbcAudience,
  type UbcSendResult,
  type UbcVerifyResult,
} from "./lib/ubc-verification";

/**
 * Sending and checking UBC verification codes, behind the membership actions.
 *
 * Both always work on the member's saved `ubc_email`, never an address the
 * client sends, so changing the address means saving the form again. Logs
 * identify the member by id and never carry the code or the address, except
 * the one development line that stands in for the email when Resend isn't
 * configured.
 */

/** Claims a send for the saved address and emails the code on success. */
export async function sendUbcCode({
  audience,
  email,
  userId,
}: {
  audience: UbcAudience;
  email: string;
  userId: string;
}): Promise<UbcSendResult> {
  const code = generateUbcCode();
  const salt = newUbcCodeSalt();

  let claim: Awaited<ReturnType<typeof claimUbcCodeSend>>;
  try {
    claim = await claimUbcCodeSend(supabaseAdmin, {
      userId,
      email,
      codeHash: hashUbcCode({ code, email, salt, userId }),
      salt,
    });
  } catch (error) {
    log.error("ubc_verification.send_failed", { userId, ...errorFields(error) });
    return { status: "send_failed" };
  }

  if (claim.result !== "ok") {
    log.warn("ubc_verification.send_refused", { userId, reason: claim.result });
    switch (claim.result) {
      case "cooldown":
        return {
          status: "cooldown",
          resendAt: claim.resendAt ?? new Date().toISOString(),
          expiresAt: claim.expiresAt,
        };
      case "daily_cap":
        return { status: "daily_cap" };
      case "taken":
        return { status: "taken" };
      case "already_verified":
        return { status: "already_verified" };
      default:
        // The saved address moved under us; the form saves it again.
        return { status: "send_failed" };
    }
  }

  const sent = { status: "sent", resendAt: claim.resendAt!, expiresAt: claim.expiresAt! } as const;
  const { html, subject } = renderUbcVerificationCodeEmail({
    code,
    expiresInMinutes: UBC_CODE_TTL_MINUTES,
  });

  try {
    const delivered = await sendEmail({ html, subject, to: email });
    if (!delivered) {
      // No RESEND_API_KEY. Locally the log line stands in for the inbox; in
      // production nobody would ever get the code.
      if (process.env.NODE_ENV !== "production") {
        log.info("ubc_verification.dev_code", { userId, code });
        return sent;
      }
      log.error("ubc_verification.send_failed", { userId, reason: "no_api_key" });
      return { status: "send_failed" };
    }
  } catch (error) {
    log.error("ubc_verification.send_failed", { userId, ...errorFields(error) });
    return { status: "send_failed" };
  }

  log.info("ubc_verification.code_sent", { userId, audience });
  return sent;
}

/**
 * Checks a typed code: counts the attempt, compares in Node in constant time,
 * then stamps the verification for the same send it compared against.
 */
export async function verifyUbcCode({
  email,
  input,
  userId,
}: {
  email: string | null;
  input: unknown;
  userId: string;
}): Promise<UbcVerifyResult> {
  const code = normalizeUbcCodeInput(input);
  if (!code) {
    log.warn("ubc_verification.code_rejected", { userId, reason: "malformed" });
    return { status: "malformed" };
  }
  if (!email) {
    log.warn("ubc_verification.code_rejected", { userId, reason: "none" });
    return { status: "none" };
  }

  try {
    const attempt = await beginUbcCodeAttempt(supabaseAdmin, { userId, email });
    if (attempt.result !== "ok") {
      log.warn("ubc_verification.code_rejected", { userId, reason: attempt.result });
      return { status: attempt.result };
    }

    const actual = hashUbcCode({ code, email, salt: attempt.codeSalt!, userId });
    if (!ubcCodeHashesMatch(attempt.codeHash!, actual)) {
      log.warn("ubc_verification.code_rejected", { userId, reason: "wrong" });
      const attemptsLeft = attempt.attemptsLeft ?? 0;
      return attemptsLeft > 0 ? { status: "wrong", attemptsLeft } : { status: "locked" };
    }

    const result = await completeUbcCodeVerification(supabaseAdmin, {
      userId,
      email,
      challengeSentAt: attempt.challengeSentAt!,
    });
    if (result === "verified" || result === "already_verified") {
      log.info("ubc_verification.verified", { userId, via: "code" });
      return { status: "verified" };
    }
    log.warn("ubc_verification.code_rejected", { userId, reason: result });
    return { status: result };
  } catch (error) {
    log.error("ubc_verification.verify_failed", { userId, ...errorFields(error) });
    return { status: "error" };
  }
}
