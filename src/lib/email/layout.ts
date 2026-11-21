/**
 * Shared chrome for every email UX Hub sends.
 *
 * Two very different consumers render through this:
 *
 * - `templates.ts` builds purchase receipts at request time, with real values
 *   interpolated in TypeScript.
 * - `auth-templates.ts` builds the Supabase auth emails, which are static HTML
 *   files holding Go placeholders like `{{ .ConfirmationURL }}` that GoTrue
 *   fills in when it sends. Those files are generated into `supabase/templates`
 *   by `pnpm email:templates`.
 *
 * Keeping the markup here is what stops the two from drifting apart. This
 * module must not import anything through the `@/*` alias: the generator runs
 * under plain Node, which does not resolve it.
 */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A primary action button. `url` is emitted raw so callers can pass a Go
 * template placeholder; never pass user-supplied input here.
 */
export function ctaButton({ label, url }: { label: string; url: string }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td style="border-radius:8px;background:#111827;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/**
 * Where emails load their images from. Always production: a local or preview
 * origin would not load in a real inbox, and the auth templates are static
 * HTML stored in Supabase, so they need an absolute URL that never changes.
 */
export const EMAIL_ASSET_ORIGIN = "https://www.ubcuxhub.ca";

/**
 * Hubbo, the mascot, in each emotion an email can show, with the natural size
 * of its art. The PNGs in `public/email/hubbo-<emotion>.png` are copies of
 * `src/assets/hubbo/<emotion>.png`: the app imports those through
 * `next/image`, whose hashed URLs can't be linked from an email.
 */
export const HUBBO_EMOTIONS = {
  curious: { width: 302, height: 344 },
  excited: { width: 256, height: 362 },
  proud: { width: 266, height: 366 },
  resting: { width: 466, height: 346 },
  thinking: { width: 346, height: 366 },
  welcoming: { width: 242, height: 336 },
} as const;

export type HubboEmotion = keyof typeof HUBBO_EMOTIONS;

/** Hubbo's width in the email, in CSS pixels; the height keeps the art's ratio. */
export const HUBBO_EMAIL_WIDTH = 120;

export function hubboImageUrl(emotion: HubboEmotion) {
  return `${EMAIL_ASSET_ORIGIN}/email/hubbo-${emotion}.png`;
}

/**
 * Hubbo centred above the heading. Explicit `width` and `height` keep the
 * layout steady while it loads, and a short alt reads in its place when the
 * client blocks images.
 */
function hubboImage(emotion: HubboEmotion) {
  const art = HUBBO_EMOTIONS[emotion];
  const width = HUBBO_EMAIL_WIDTH;
  const height = Math.round((art.height * width) / art.width);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:0 0 20px;">
            <img src="${hubboImageUrl(emotion)}" width="${width}" height="${height}" alt="Hubbo" border="0" style="display:block;margin:0 auto;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;font-size:13px;color:#9ca3af;">
          </td></tr>
        </table>`;
}

export function renderEmailLayout({
  body,
  heading,
  hubbo,
  intro,
}: {
  body: string;
  heading: string;
  /** Hubbo's emotion for this email, shown above the heading. Omit for none. */
  hubbo?: HubboEmotion;
  intro: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        ${hubbo ? `${hubboImage(hubbo)}\n        ` : ""}<h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(intro)}</p>
        ${body}
        <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">UBC UX Hub</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
