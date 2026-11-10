# Auth and onboarding: Figma vs code review

Review date: 2026-11-09. Figma: UX Hub Portal (`hzJM3bL3wYWNG5RvqH7RaT`), page
`157:132` "Log in/Sign Up/Forgot Pass", draft dated October 26, 2026. Code:
`main` at `e66d041`. Review only; no code was changed.

Frame screenshots used for this review are in the session scratchpad, not the
repo. Copy below is read from screenshots, so treat quoted strings as close
but not character-exact (no `get_design_context` pass was done).

## 1. What the design is for

**Goal:** "Make joining UX Hub feel exciting, and getting back in feel
effortless." Sign in stays on one screen; everything optional moves after the
account exists; each setup step says why it's there.

**Principles:** (01) account first, profile second: only name, email and
password before the account exists; dietary needs (required, "None" counts),
photo and interests (skippable) follow inside sign-up. (02) "Step N of 3"
above each heading; Back always there; Skip only on optional steps. (03) say
why we ask. (04) personality in welcomes and empty moments; errors, passwords
and resets stay plain. (05) sign-in, setup and reset all land on Home.

**Flow (4268:2):** Arrive → Sign in (Google or email) → *Email verified?* (no →
Verify email) → *Profile set up?* (no → resume at the step they left) →
Portal Home. New member: Sign up → Verify email (email only; Google skips it)
→ Dietary needs (1/3) → Choose a photo (2/3) → Pick interests (3/3) → Welcome
(first Home). Reset: Forgot password → Check your email → Set new password →
signed in → Home.

**Decisions it records:** Google and email accounts with the same address link
automatically, with a message saying so; any Google account works (not only
UBC); setup resumes where it was left; unverified accounts always go to Verify
email before setup; no membership ask during onboarding; interests and dietary
needs are visible to the UX Hub team (interests also as admin Dashboard
totals) and never filter what members see.

**Success metrics:** sign-up completion ≥85%, median time to Home <3 min,
setup finished (photo + ≥1 interest) ≥60%, failed sign-ins <10%.

## 2. Screen by screen

Status key: **matches**, **differs**, **missing in code**, **extra in code**.

### Shared shell (every frame)

| Figma | Code | Status | Differences |
| --- | --- | --- | --- |
| Brand panel: 480px gradient column with a halftone texture, two-line white logo top left, six blue shape tiles stacked bottom left | `src/app/(auth)/auth/layout.tsx` | differs | Code column is `minmax(320px,467px)`, plain `bg-ux-hub` gradient, no texture, no shape tiles, larger logo. |
| Card: 600px wide, thin border, ~40px padding, **left-aligned** title and description | `AuthPanel` | differs | Code centres title and description, `max-w-[560px]`, `py-16`. Design description is muted grey; code uses `text-foreground`. |
| Mobile (section 4329:7): 176px gradient header with white logo; white sheet with 24px top radius overlapping by 32px; no card border; 20px margins; full-width stacked buttons, main action last | `layout.tsx` below `lg` | differs | Code hides the brand aside below `lg` (**no logo at all on mobile**) and floats the bordered card on a full-bleed gradient. |
| Toasts bottom right ("Email sent to …") | `sonner` toast exists (`src/components/ui/toast.tsx`) | missing in code | Auth screens report resend inline as text. |
| Hubbo illustration slots ("Hubbo with a letter", "Hubbo, thinking") | `src/components/shared/Hubbo.tsx` | missing in code | Component and "thinking" art exist; there is no "with a letter" pose in the six emotions. |

### Sign in (4267:2 empty, 4273:2 filled, 4272:2 error) → `/auth/login`, `LoginForm`

| Aspect | Figma | Code | Status |
| --- | --- | --- | --- |
| Heading / description | "Sign in" / "Sign in to the UBC UX Hub Portal." | "Sign in" / "Continue to the UBC UX Hub Portal with:" | differs (copy) |
| Divider | Rule with "or sign in with email" | Plain text "or continue with email" (same on sign-up) | differs |
| Forgot password? | Beside the Password label | Same | matches |
| Password | Show/hide eye button; placeholder "Enter your password" | No show/hide (the `Input` primitive has none); same placeholder | differs |
| Submit | Disabled until both fields have text; "Signing in…" while working | Always enabled (native `required`); "Signing in..." | differs (see §6) |
| Wrong credentials | Red border on Password; "That email and password don't match. Try again or reset your password." | Form-level `FieldError`: "Unable to sign in. Check your email and password, then try again." | differs |
| Unverified email | Goes to Verify email | Supabase "Email not confirmed" falls through to the same generic error | **missing in code** |
| Google on an existing email account | Links them, toast "You already had an account with this email. You can now sign in with Google too." | Supabase links verified identities silently; no message | missing in code |
| Destination | Always Home | `next` param (deep links) | differs (see §6) |

### Forgot password (4276:2 empty, 4271:2 filled, 4275:2 sending, 4274:2 error) → `/auth/forgot-password`, `ForgotPasswordForm`

Marked "Keep" in Figma; close already.

| Aspect | Figma | Code | Status |
| --- | --- | --- | --- |
| Heading / description | Same copy | Same | matches |
| Carry over email typed on Sign in | Yes | No | missing in code |
| Submit | Disabled when empty; spinner-only while sending | Enabled; "Sending..." label | differs |
| Invalid email | "Enter a valid email address." under the field, red border | Browser's native `type=email` bubble | differs |
| Footer link | "Remember your password? Back to sign in" | "Remember your account? Back to log in" | differs (copy) |
| Timeout copy | — | "We could not confirm whether the reset email was sent…" | extra in code (good) |

### Check your email, reset (4282:2 sent, 4278:2 resent) → `/auth/check-email`, `CheckEmailMessage`

| Aspect | Figma | Code | Status |
| --- | --- | --- | --- |
| Illustration | Hubbo with a letter (placeholder) | None | missing in code |
| Heading | "Check your email" | "Check your email!" | differs (exclamation mark; design system §2.9 bans it in functional copy) |
| Body | "If an account exists for **email**, we'll send…" | Same wording, email not bold; falls back to "that email address" when session storage is empty | matches |
| Resend | "Didn't get an email? Resend email"; "Sending…", then toast | "Didn't receive an email? Resend email"; "Resending..."; inline "Email resent."; Supabase cooldown shown as a live countdown | differs |
| Back link | "Back to sign in", left-aligned | "Back to log in", centred | differs |

### Set new password (4277:2 empty, 4279:2 filled, 4281:2 too short, 4280:2 link expired) → `/auth/update-password`, `UpdatePasswordForm`

| Aspect | Figma | Code | Status |
| --- | --- | --- | --- |
| Heading / description | "Set a new password" / "Choose a new password for **email**. You'll be signed in once it's saved." | "Reset your password" / "Please enter your new password below." | differs |
| Field | Show/hide; hint "At least 8 characters." | No show/hide, no hint, **no client length check** | differs |
| Too short | "Use at least 8 characters." in red | Relies on Supabase; local `config.toml` has `minimum_password_length = 6`, so a 6-character password is accepted locally | **differs (bug-level)** |
| Button | "Save password", disabled until valid | "Save new password" | differs |
| After save | Signed in, Home | `router.push("/portal")` | matches |
| Link expired | Dedicated "This link has expired" screen: "Reset links only work for a short time. Send a new one to **email**." with Back to sign in + Send new link | Redirect to generic `/auth/error`: "Sorry, something went wrong." + message + "Request another reset link" (to the empty forgot form) | **missing in code** |

### Sign up (4283:2 empty, 4298:2 filled, 4293:2 password too short) → `/auth/sign-up`, `SignUpForm`

| Aspect | Figma | Code | Status |
| --- | --- | --- | --- |
| Description | "Create your UX Hub account to register for workshops, socials and UXathon." | "Create a new account." | differs |
| Fields | First name, Last name, Email, Password (show/hide) | Same plus **Confirm password** | differs (design drops it) |
| Labels | Sentence case, no asterisks ("First name") | "First Name *", "Email *" | differs (§2.9: sentence case; mark the optional fields, not the required ones) |
| Placeholders | "First", "Last", "name@example.com", "Create a password" | "First name", "Last name", …, "Enter your password" | differs |
| Password hint / error | Hint "At least 8 characters."; error "Use at least 8 characters." | "Password must be at least 8 characters." (hint replaced by error) | differs (copy) |
| Submit | "Create account", disabled while invalid | "Complete sign up", always enabled, validates on submit | differs |
| Email already used with Google | After Verify email, accounts link: "You already signed up with Google using this email. We've linked them…" | Supabase returns an obfuscated user; code goes to the success screen; no message | missing in code |
| Destination | Verify email | `/auth/sign-up-success` | differs (see next) |

### Verify email (4285:2 sent, 4294:2 resent) → `/auth/sign-up-success`, `SignUpSuccessMessage`

| Aspect | Figma | Code | Status |
| --- | --- | --- | --- |
| Illustration | Hubbo with a letter | None | missing in code |
| Heading / body | "Check your email" / "We sent a verification link to **email**. Open it to confirm your email and set up your profile." | "Thank you for signing up!" / "We've sent a confirmation link to … Confirm your account to finish signing up." | differs |
| Resend | Same as reset: "Sending…", toast "Email sent to …" | Inline status + cooldown; checks for a session first | differs |
| Change email | "Wrong email? Change email" | None | **missing in code** |
| Back to log in | Not on this screen | Present | extra in code |
| Auto-continue when confirmed in another tab | Not specified | Listens for auth state, focus and visibility, then redirects | extra in code (good) |

### Change email (4286:2 empty, 4288:2 filled, 4290:2 same email) → none

**Missing in code.** "Change your email": "We'll send a new verification link to this address. The link sent to **old** will stop working." Email field, Back + Send link (disabled while empty). Same-email error: "That's the email we already sent a link to. Enter a different one." See §3 for why this needs backend work.

### Verify link expired (4291:2 default, 4296:2 sending) → none

**Missing in code.** Hubbo thinking; "This link has expired"; "Verification links only work for a short time. Send a new one to **email**." Back to sign in + Send new link (spinner while sending). Today an expired or reused confirmation link lands on `/auth/error` with "We couldn't complete sign-in. The link may have expired or already been used. Try signing in again."

### Onboarding steps → none

| Figma | Code | Status | Notes |
| --- | --- | --- | --- |
| Step 1 Dietary needs (4289:2): "Step 1 of 3", "Any dietary needs?", "The UX Hub team sees this so every event has food you can eat. Pick all that apply." Diet chips (Vegetarian, Vegan, Pescatarian, Halal, Kosher); Allergies and intolerances chips (Peanuts, Tree nuts, Dairy, Eggs, Gluten, Soy, Fish, Shellfish); Other allergies input ("Press Enter to add each one.", entries become chips); "or" + "I don't have any dietary needs"; Save dietary needs | Settings has one free-text "Dietary restrictions" field (`ProfileFields.tsx`) | missing in code | No Back or Skip on this step. |
| Step 2 Choose a photo (4292:2): preview card (avatar + name + "This is how you'll appear to other members."), five Hubbo presets + dashed Upload circle, "Uploads must be JPG or PNG.", Back / Skip for now / Use this photo | Admin-only photo upload (`/api/admin/users/[userId]/photo`) | missing in code | Hubbo preset art is `[PLACEHOLDER]`. |
| Step 2 Crop photo (4287:2): "Crop your photo" dialog, drag to move, Zoom slider (shown at 140%), Cancel / Use photo | `Slider` exists and its demo is already titled "Crop dialog zoom"; no cropper | missing in code | Circle mask in a square crop. |
| Step 3 Pick interests (4297:2): "What are you into?", "The UX Hub team sees your interests so we can plan events you'll enjoy."; chip groups Design (8), Events (7), Career (4); "4 selected"; Back / Skip for now / Finish setup | `user_info.interests` exists, edited only by admins as free-text tags | missing in code | List marked `[PLACEHOLDER LIST]`. |
| Welcome (described in 4269:2, no frame) | Portal home says "Hey, {first}!" and shows the membership card or a join prompt | differs | Design: "Welcome to UX Hub, [first name]", new photo, every upcoming event, no membership prompt; later visits "Hello, [first name]". |

Note: the dev gallery's `setup-outline` composition
(`src/app/dev/gallery/_compositions/builder.tsx`) is the admin **event
builder's** section navigator, not member onboarding. And "membership
onboarding" in CLAUDE.md means the membership join dialog
(`/portal/membership/join`). Nothing member-setup-shaped exists today; call the
new flow "setup" to avoid the name clash.

## 3. Flow-level gaps

1. **Unverified sign-in.** Supabase rejects unconfirmed accounts with "Email
   not confirmed"; `AUTH_ACTION_ERRORS.signIn` swallows it. Map that error to
   the Verify email screen (and resend from there).
2. **Change email from Verify email.** With confirmations on there is no
   session before the link is clicked, so `auth.updateUser({ email })` isn't
   available. Options: (a) re-run `signUp` with the new address and have a
   server action delete the old unconfirmed auth user with the service role;
   (b) only re-send to the new address and leave the old account to expire.
   (a) makes "the old link will stop working" true but must prove the caller
   made the pending sign-up, or anyone could delete unconfirmed accounts by
   email. A short-lived signed httpOnly cookie set at sign-up (user id + HMAC)
   fits the existing pattern (`CHECK_IN_TOKEN_SECRET`-style secret). The
   "same email" check is client-side against the pending email.
3. **Link-expired handling.** The callback treats every provider error the same
   way. Supabase redirects with `error_code` (e.g. `otp_expired`); route that
   to the two expired screens. The design shows the address, but it's only
   known in the browser that started the flow (`pending-email.ts` session
   storage). On another device or after a tab close the screen needs an email
   field instead.
4. **Cross-device links.** Confirmation and recovery emails use
   `{{ .ConfirmationURL }}` with PKCE `exchangeCodeForSession`, which needs the
   code verifier cookie from the browser that asked. A link opened on a phone
   after signing up on a laptop fails and looks "expired". A token-hash link
   (`{{ .TokenHash }}` + an `/auth/confirm` route calling `verifyOtp`) fixes
   both confirmation and reset. Worth doing alongside the expired screens, as
   it changes what "expired" means.
5. **Resend timing.** Code already handles Supabase's cooldown (`max_frequency
   = "60s"` locally) with a countdown; the design only says "pauses briefly".
   Keep the code's behaviour; the local `email_sent = 2` per hour rate limit
   will bite during manual testing.
6. **Password length.** Client rule is 8 (sign-up only); Supabase local is 6
   and the update form has no client check. Set `minimum_password_length = 8`
   in `supabase/config.toml` and in the hosted project's Auth settings, and
   share one `MIN_PASSWORD_LENGTH` between sign-up and reset.
7. **Where setup starts and whether it can be skipped.** The flow's
   "Profile set up?" check runs after every sign-in. Proposal: gate in
   `src/app/(app)/(shell)/layout.tsx` (not the `(app)` layout, so
   `(confirmation)` receipts and the `@flow` dialogs keep working), redirect to
   `/portal/setup` while the user's setup step isn't `done`, and resume at the
   stored step. Dietary can't be skipped; photo and interests can. Sign-out
   should stay reachable from setup (the design has none; add a quiet link).
8. **Existing members.** Every current `user_info` row would fail the check.
   Backfill them as `done` in the migration so only new accounts see setup.
   Imported/seeded rows adopted at first sign-up (`ensureUserInfo`) would also
   be `done`; decide whether adoption should reset them to step 1.
9. **Deep links vs "always Home".** Login and the callback honour `next` (e.g.
   arriving from an event page). Keep that: send new members through setup,
   then to `next`.
10. **Google first sign-in.** `ensureUserInfo` returns a conflict ("missing a
    first or last name") when Google gives no family name (single-word
    names, some Workspace accounts). The design has no name step for Google,
    so this ends at the error page. Either fall back to `last_name = ""` (the
    column is not null; check the constraint) or add a name field to Step 1
    for this case.
11. **Account-linking messages.** Supabase links a Google identity to a
    verified email user automatically (`enable_manual_linking = false`), but
    tells the app nothing. Detect it in the callback (identity count rose, or
    the Google identity's `created_at` is seconds old while the user is older)
    and set a one-shot flash for the toast. For the sign-up-after-Google case,
    Supabase hides existing accounts on `signUp` to avoid enumeration, so the
    "We've linked them" message can only appear after verification.
12. **Error page as a message board.** `/auth/error` renders any `?error=`
    string. It's text, so not XSS, but a crafted link can show arbitrary copy
    under the UX Hub brand. The expired screens are a chance to switch to error
    codes mapped to fixed copy.
13. **Metrics.** Only `@vercel/analytics` page views exist. Completion, skip
    and time-to-Home need events (Platform's audit log / activity feed, or
    Vercel custom events); nothing records "skipped photo" today.

## 4. Onboarding: data and backend

Existing (`src/lib/supabase/database.types.ts`, `user_info`):

| Need | What exists | Gap |
| --- | --- | --- |
| Setup progress | Nothing | New column, e.g. `setup_step text not null default 'done' check (setup_step in ('dietary','photo','interests','done'))`, then `alter … set default 'dietary'` in the same migration so existing rows are `done` and new rows start at 1. Backward-compatible: old code never reads it. |
| Dietary needs | `dietary_restrictions text` (free text, authenticated UPDATE grant, nulled by `delete_account`) | Structured storage: e.g. `diet text[]` and `allergies text[]` (chip ids plus "other" free entries, with a validator like `valid_user_interests`). "None" = both empty and `setup_step` past dietary. Decide whether to migrate or keep the legacy text (Settings edits it today). Add the new columns to account-deletion scrubbing. Allergies are health-adjacent data: keep them out of logs and exports by default. |
| Admins see dietary | Not shown anywhere in admin UI | Admin user record + CSV export (Admin epic). |
| Photo, upload | `profile_photo_path` + public `profile-photos` bucket (4 MiB, JPEG/PNG), path check `profiles/<id>/<uuid>.(jpg|png)`, writes server-only via `replaceProfilePhoto` from an admin route | Member route (`requireAuth`, own id only) reusing `parseProfilePhoto` and `replaceProfilePhoto`. Crop in the browser to a square canvas and upload that (also strips EXIF/GPS). |
| Photo, Hubbo preset | Nothing; the path constraint rejects non-uploaded paths | New `avatar_preset text` (check against a fixed list) or a relaxed path rule; `Avatar` needs to render it. Art is a placeholder. |
| Interests | `interests text[]` (≤20 tags, ≤50 chars, unique case-insensitively), no authenticated grant ("intentionally"), admin edits free tags | A fixed taxonomy constant (ids + labels + groups; 19 options fits the 20 cap) written through a server action. Decide whether admin free tags and member choices share the column; if they do, the admin field should use the same chip picker. Dashboard totals are an aggregate query (Admin epic). |
| Welcome | Portal home | First-visit variant needs either a flash after "Finish setup" or the upcoming-events list from Student experience's timeline work. No column needed. |
| Edit later | Settings has dietary (free text) only | Settings needs dietary chips, photo and interests, or skipped steps can never be filled in. |

Every new column needs `pnpm types:supabase`, helpers in
`src/lib/supabase-helpers`, RLS checks in `supabase/tests/rls.sql`, and
`pnpm test:integration`.

## 5. Animated components (section 4329:11)

**Falling shapes (4326:2).** Six shape tiles drop from 850–1100px above the
panel, rotate from ±8–20° to 0, overshoot by 14px and settle; staggered starts
from 0.15s to 1.05s; 2.25s total; Figma loops it. Build: CSS keyframes on six
absolutely positioned SVGs (no motion library is installed, and none is
needed); play once when the auth layout mounts. The layout persists across
`/auth/*` navigations, so it won't replay between sign-in and sign-up. Needs
the shape SVGs exported from the "Brand panel / desktop" symbol (4352:1416).

**Gradient cursor glow (4313:2).** A soft white radial glow with five fading
trailing copies follows the pointer over the brand panel (the Figma
keyframes fake a 3.6s path). Build: one `pointermove` listener on the aside,
`requestAnimationFrame`, lerped `transform: translate3d` on six divs painted
with `radial-gradient` (avoid animating `filter: blur`). Pointer-only (`(hover:
hover)`); nothing on touch; stop when the tab is hidden. A few hundred bytes
of client JS in a small client component; the rest of the layout stays a
server component.

**Fit with the rules:**

- Design system §2.8: "One curve, ease-out … never linear or bounce" and
  "Reduced motion keeps only fades". The falling shapes use linear and ease-in
  segments and a bounce, and Figma loops them. Either re-time to ease-out
  without the overshoot, or record an explicit exception for the brand panel.
  Never loop.
- Reduced motion: show the settled shapes (or fade them in) and no glow.
- Logo §5.1 says the gradient is "marketing only, never the portal". The coded
  auth layout already uses it, so the rule and the code disagree today; update
  the rule to cover the pre-portal auth shell.
- Hubbo's motion rule ("never moves while someone reads or types") is a good
  bar for the shapes too: they finish within ~2s of load and should never
  restart while a field has focus.
- Performance: transforms only; the six shapes are tiny SVGs. Below `lg` the
  panel becomes a 176px header; skip both effects there.

## 6. Where the code is better, or the design conflicts with rules

- **Disabled submit buttons.** The design disables Sign in, Send reset link,
  Save password, Create account and Send link until fields are valid. The code
  deliberately validates on submit so the failing rule "names itself on the
  field" (comment in `SignUpForm`), and design system §3.2 says errors appear
  "after blur or submit". Disabled buttons give keyboard and screen-reader
  users no reason. Keep enabled buttons with field errors.
- **Spinner-only buttons.** Frames 4275:2 and 4296:2 show a bare spinner; the
  screen notes say "Sending…". Keep the visible text (or at least an
  accessible name) and the button width.
- **Password placeholders.** §3.2: "passwords have none". The design's own note
  says drop "Enter your password", but every password frame still has one
  (including the error state). Drop them in code.
- **Hint and error both showing.** The too-short frames show "Use at least 8
  characters." and the hint "At least 8 characters." together. Code swaps the
  hint for the error; keep that.
- **Deep-link return (`next`).** Better than "always land on Home" for members
  who arrive from an event page.
- **Resend cooldown countdown, timeout-aware errors, stalled-navigation
  recovery, auto-continue when the confirmation happens in another tab,
  pending email kept out of the URL.** None are in the design; keep all.
- **Hubbo as avatar presets.** §5.2 says one Hubbo per screen and never on
  private info such as profiles and settings. Step 2 shows six Hubbos and makes
  Hubbo the member's profile picture. Needs a design-system decision (or
  non-Hubbo presets).
- **"with a letter" pose.** Not one of the six documented emotions; needs new
  art or a mapping (Welcoming).
- **Expired screens inconsistent with each other.** Verify-expired has Hubbo
  thinking; reset-expired has none.
- **Step 1 has no Back**, although principle 02 says Back is always there.
  Right for the screen (there's nothing to go back to once the account
  exists); the principle text should say so.
- **Toast copy** differs between the notes ("Email sent again") and the frames
  ("Email sent to …"). Pick one.
- **"Next to your name at events".** The photo step promises this, but no
  member-facing attendee list shows member photos today
  (`EventPeopleCard` shows judges and mentors). Either soften the copy or
  confirm that list is coming. The bucket is public, so photos are reachable
  by URL regardless.
- **Exclamation marks and casing.** The design fixes code's "Check your
  email!", "Thank you for signing up!", "Hey, {name}!" and "First Name *";
  these follow §2.9, so adopt them.

## 7. Proposed implementation split

Each piece is independent once its dependencies land. Sizes: S ≈ <300 lines,
M ≈ 300–800, L ≈ 800+.

| # | PR | Size | Depends on | Migration |
| --- | --- | --- | --- | --- |
| 1 | **Auth shell.** Shared `AuthShell` (brand panel with texture and static shapes, mobile header and sheet), left-aligned `AuthPanel` with optional illustration and step-label slots, toast on auth pages. Reusable by the setup layout. | M | – | No |
| 2 | **Password input.** Show/hide variant of `Input` (accessible toggle, `aria-pressed`, tooltip) + dev demo + tests. | S | – | No |
| 3 | **Sign in and sign up.** Copy, divider, drop Confirm password, labels and placeholders, error copy on the right field, "Email not confirmed" → Verify email, carry email to Forgot password, Google single-name fallback, Google link toast. | M | 1, 2 | No |
| 4 | **Password reset.** Forgot copy, check-email (Hubbo, toast), Set new password (email shown, 8-char rule shared), reset-link-expired screen with Send new link, `minimum_password_length = 8` (plus hosted setting). | M | 1, 2 | No (config only) |
| 5 | **Verify and change email.** Rename the success screen to Verify email, Change email (signed pending-sign-up cookie + service-role cleanup of the old unconfirmed user), verify-link-expired screen, `error_code` routing in the callback, token-hash links with an `/auth/confirm` route (updates `auth-templates.ts`; run `pnpm email:templates`). | L | 1, 3 | No (Supabase auth only; new server secret) |
| 6 | **Setup foundation.** Migration (`setup_step`, dietary arrays, `avatar_preset`, grants or server actions, deletion scrub, backfill), types, helpers, RLS and integration tests, `(shell)` gate, `/portal/setup` route group on the auth shell, step header with focus-and-announce on step change. | M–L | 1 | **Yes** |
| 7 | **Step 1, dietary needs.** FilterChip groups, Other allergies chip input, None exclusivity, Save. | M | 6 | No |
| 8 | **Step 2, photo.** Presets radio group, member upload route, crop dialog (Slider, drag, keyboard nudging), live preview, GIF error, Skip. | L | 6; Hubbo art and DS decision | No |
| 9 | **Step 3, interests and welcome.** Taxonomy constant, chips with count, Finish setup, first-visit Home variant without the membership prompt. | M | 6; final list; portal timeline for "every upcoming event" | No |
| 10 | **Settings parity.** Dietary chips, photo and interests in the Settings dialog; admin interests field on the same taxonomy. | M | 7–9 | No |
| 11 | **Brand panel motion.** Falling shapes (once) and cursor glow, reduced-motion and touch fallbacks. | S | 1; §2.8 decision | No |

Only #6 needs a migration. #3 and #4 can ship in parallel after #1 and #2;
#7–#9 can ship in parallel after #6.

## What I couldn't read or verify

- Mobile frames (section 4329:7) were checked only at overview resolution;
  they look like the desktop states in the mobile shell described in 4269:2.
- No `get_design_context` pass, so spacing, tokens and copy are from
  screenshots, not exact values.
- Placeholders in Figma: Hubbo art (letter, thinking, presets), the interests
  list, and the Welcome screen (described, not drawn).
- The hosted Supabase project's auth settings (password length, rate limits,
  Google provider, redirect URLs) aren't in the repo.
- Coded pages were viewed in the browser while signed out only; the portal
  home and settings were reviewed from code.
