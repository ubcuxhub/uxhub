# Settings: Profile tab redesign

Design proposal for the Profile tab of the Settings dialog (`#settings/profile`).
There is no Figma for Settings; the brief is "make it look nice and clean". Built
as working UI on fixture data in the dev docs. The production tab
(`ProfileSettings`, `ProfileFields`, `SetupSettings`) is unchanged.

Where to look (run `pnpm dev`, no sign-in needed):

| Template | Shows |
| --- | --- |
| `/dev/templates?open=profile-filled` | Member with everything set, active membership, locked student number |
| `/dev/templates?open=profile-new` | Signed up and skipped setup: initials, nothing optional set, dietary not answered |
| `/dev/templates?open=profile-saving` | Admin with a preset icon, photo chooser open, About you saved, Food saving |
| `/dev/templates?open=profile-error` | Non-member: About you failed to save (Retry works), invalid student number |

Each also renders alone with `-frame` (e.g. `?open=profile-new-frame`), which is
what the 375px iframe shows; at a desktop window the frame is the dialog at its
real 1000 x 760. All four work in dark mode. Saving is faked per section: 800ms
debounce, then 600ms.

Code:

- `src/features/settings/components/profile-redesign/` (promotable):
  `ProfileTab` (the tab body, presentational), `ProfileHeader`,
  `ProfileSection`, `model.ts` (section ids, membership summary, labels).
- `src/app/dev/templates/profile.tsx` (design-only): fixtures, the fake
  autosave and a static copy of the dialog chrome.

## 1. Problems with the current tab

Read from `ProfileSettings.tsx`, `ProfileFields.tsx` and `SetupSettings.tsx` on
`feat/auth-setup`, against the General and Purchase history tabs.

1. **No identity at the top.** The tab opens on "Changes save automatically."
   and then a full-width grid of seven or eight avatar tiles. The member's
   current picture is only a ring on one tile (the picker runs with
   `preview={false}`), and name, membership and role appear nowhere until the
   Account panel at the very bottom.
2. **Order splits related things.** Photo, About you, Dietary, Interests,
   Studies, Account. The two long chip sections sit between the name fields and
   the studies fields, so "who I am" is broken in half, and membership status
   (the thing members most often check) is last.
3. **Flat hierarchy, long page.** Section titles are `text-button` (16/500) and
   the legends inside Dietary and Interests are `text-body-medium` (16/500):
   the same size, so sections and sub-groups read as one list. Only 32px of
   space separates sections; no rules, no columns. Everything, including the
   photo grid, is always expanded.
4. **Autosave feedback is far from the change.** One "Saving… / Saved" line at
   the top serves five independently saving sections. Editing Interests at the
   bottom reports to a line scrolled out of view; two sections saving at once
   overwrite each other's status; "Saved" vanishes after 2s; an error appears
   at the top with no Retry, away from the section that failed. Photo uploads
   don't report there at all.
5. **Field styling drifts from the system.** Labels are `Label` with
   `text-muted-foreground` (grey), while §3.2 and the setup screens use
   `body-medium` foreground labels. `LockedField` is a 36px `rounded-md` grey
   box beside 40-44px pill inputs. Optional fields aren't marked "Optional".
6. **Field widths.** A plain two-column grid gives Faculty (the longest values)
   the same half width as Year ("5+"), and pairs Faculty with Major.
7. **Validation timing.** Name errors appear on the keystroke that empties the
   field, not after blur (§3.2).
8. **Empty states.** A new member sees dietary chips all off with no hint that
   it is unanswered (versus "no needs"), "0 selected" interests, no avatar at
   all, and "Membership expires —" for a non-member.
9. **Copy.** "User type" (system term; §2.9 says Member in member-facing copy),
   raw role values, "Studies" vs "At UBC" with no school wording for non-UBC.
10. **Phone width.** The single-column stack is very long (photo grid, two chip
    sections, then studies); the Account rows put a long email beside its label
    in a row that doesn't wrap, so it can overflow.

## 2. The design

**Header: who this is.** Avatar (64px, 80px in a wide pane) as others see it,
name in `text-h3`, sign-in email, a membership badge (success "Innovator
member" + "Until Aug 31, 2027"; warning "Payment processing" for a pre-order;
neutral "Not a member"), and a tag badge for Admin or Manager only. "Change
photo" ("Add photo" with nothing set) opens the existing `AvatarPicker` in a
panel right under the header rather than a second dialog (§3.7, one overlay at
a time; only the crop step is a dialog, as in setup). The panel has its own
save status and a Done button. One line under the header says "Changes save as
you go."

**Sections, in this order.**

1. About you: first and last name, pronouns and phone (both "Optional").
2. Studies / At UBC / School (by account type): faculty and major full width,
   year and student number side by side. Locked values are disabled inputs
   with "Locked while your membership is active. Ask an exec to change it."
3. Food and allergies: `DietaryFields` as in setup. "Not answered" badge until
   the member answers (including "I don't have any dietary needs").
4. Interests: `InterestFields`; a badge says "4 selected" or "None selected".
5. Account (read only): email, account type ("UBC student"), membership with
   its end date, joined. Uses `DetailList`/`DetailRow`.

Personal details first, eligibility next to them, preferences after, fixed
facts last. Each section has a `text-subheading` title and one-line purpose, and
sections are divided by a `border-border-subtle` rule.

**Layout.** In a wide pane (the desktop dialog's ~760px content area) each
section puts its title, description and status in a 12rem left column with the
fields on the right, the same title-beside-control rhythm as `SettingsRow` on
the General tab. Narrower, it stacks. Sizing is by container query
(`@container/profile`, `@container/fields`), not viewport, because the dialog's
sidebar takes part of the width. Field grids are two columns from 28rem, one on
phones.

**Autosave: one pattern, per section.** Each section shows the existing
`AutosaveStatus` (from the application form) under its description: "Saving…",
then "Saved · 2:41 PM", which stays; on failure "Couldn't save" with Retry,
next to what failed. Idle shows nothing (the header line covers it). No toasts.
Invalid input (empty name, bad student number) holds that section's save and
shows the field error after blur; the rest of the tab keeps saving.

**States covered.** Filled; brand new (initials, "Add photo", placeholders,
"Not answered", "None selected", "Not a member"); saving; save failed with
Retry; field validation error; locked eligibility; admin role; photo vs preset
vs initials; dark mode; 375px.

## 3. Library gaps

Everything is composed from existing pieces (`Field`, `FieldLabel`,
`FieldError`, `FieldDescription`, `Input`, `Select`, `Badge`, `Button`,
`DetailList`/`DetailRow`, `MemberAvatar`, `AvatarPicker`, `DietaryFields`,
`InterestFields`, `AutosaveStatus`). Nothing new was added to
`src/components/ui` or `src/components/shared`. Gaps worth closing before this
ships:

- **Shared autosave status.** `AutosaveStatus` lives in
  `src/features/applications` and announces "Your answers are saved." Promote
  it to `src/components/shared` with the announcement copy as a prop (Profile
  wants "Your profile is saved."). The Profile tab imports it across features
  for now.
- **Disclosure / Collapsible.** There is no collapsible primitive, so the photo
  panel is a button with `aria-expanded`/`aria-controls` and a conditional
  region. Fine for one use; add a `Collapsible` (Radix) if a second appears.
- **Settings section layout.** `ProfileSection` (title column beside content,
  container-query sized) is the settings counterpart of `SettingsRow` for
  multi-field groups. If General or Purchase history grow sections, move it to
  `src/features/settings/components` beside `SettingsRow`.

## 4. Promoting it

1. Swap `ProfileFields` + `SetupSettings`'s section wrappers for `ProfileTab`
   in `ProfileSettings`, keeping its data loading and actions. Split the single
   `saveStatus` into a per-section `ProfileSaveStates`: profile fields report
   as `about` or `studies` (by which fields changed), and `track` takes a
   section id.
2. Build the membership summary with `membershipSummary(user, membershipName,
   membershipTermEndsAt)`.
3. Track blurred fields so errors show after blur.
4. Route the photo upload through the photo section's status.
5. Move the student-number message to say what is wrong ("Student numbers are
   8 digits") in `validateStudentNumber`; the current copy only says "valid".
