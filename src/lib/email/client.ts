import "server-only";

import { Resend } from "resend";

interface SendEmailInput {
  html: string;
  subject: string;
  to: string;
}

let resend: Resend | null = null;

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resend ??= new Resend(apiKey);
  return resend;
}

export async function sendEmail({ html, subject, to }: SendEmailInput) {
  const client = getResend();

  // Local development runs without Resend credentials. Log instead of throwing
  // so checkout still completes end to end.
  if (!client) {
    console.info(`[email] RESEND_API_KEY is unset; skipped "${subject}" to ${to}`);
    return false;
  }

  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM || "UX Hub <onboarding@resend.dev>",
    html,
    subject,
    to,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
