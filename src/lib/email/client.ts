import "server-only";

import { Resend } from "resend";
import { log } from "@/lib/log";

interface SendEmailInput {
  html: string;
  subject: string;
  to: string;
}

let resend: Resend | null = null;

/**
 * A send Resend refused. `code` is Resend's error name
 * (`rate_limit_exceeded`, `daily_quota_exceeded`, `validation_error`, ...),
 * safe to log; the message can quote the address, so callers shouldn't.
 */
export class EmailSendError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
  }
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resend ??= new Resend(apiKey);
  return resend;
}

/**
 * Dotenv files quote a value containing spaces, and that syntax is easy to
 * carry into a hosting provider's plain-text field, where the quotes become
 * part of the address and the send is rejected.
 */
function getFromAddress() {
  const configured = (process.env.EMAIL_FROM || "").trim();
  const unquoted = configured.replace(/^"([\s\S]*)"$/, "$1").trim();

  return unquoted || "UX Hub <onboarding@resend.dev>";
}

export async function sendEmail({ html, subject, to }: SendEmailInput) {
  const client = getResend();

  // Local development runs without Resend credentials. Log instead of throwing
  // so checkout still completes end to end.
  if (!client) {
    log.info("email.skipped_no_api_key", { subject });
    return false;
  }

  const { error } = await client.emails.send({
    from: getFromAddress(),
    html,
    subject,
    to,
  });

  if (error) {
    throw new EmailSendError(error.name, error.message);
  }

  return true;
}
