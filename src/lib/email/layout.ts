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

export function renderEmailLayout({
  body,
  heading,
  intro,
}: {
  body: string;
  heading: string;
  intro: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(intro)}</p>
        ${body}
        <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">UBC UX Hub</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
