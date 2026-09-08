const RESEND_COOLDOWN_PATTERN =
  /^For security purposes, you can only request this after (\d+) seconds?\.?$/i;

export function getResendCooldownSeconds(error: unknown): number | null {
  if (!(error instanceof Error)) return null;

  const match = error.message.trim().match(RESEND_COOLDOWN_PATTERN);
  if (!match) return null;

  const seconds = Number(match[1]);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function getRemainingCooldownSeconds(
  cooldownEndsAt: number,
  now: number,
): number {
  return Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000));
}

export function getResendCooldownMessage(seconds: number): string {
  const unit = seconds === 1 ? "second" : "seconds";
  return `For security purposes, you can only request this after ${seconds} ${unit}.`;
}
