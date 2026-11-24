# Settings: Profile tab redesign

**Status: implemented.** The redesign is the live Profile tab of the Settings
dialog (`#settings/profile`). There is no Figma for Settings; the brief was
"make it look nice and clean". It was proposed (Nov 9) as working UI on fixture
data, then wired to the member's real row; §1 describes the tab it replaced,
and §4 records how it was wired and where it departs from §2.

Where to look (run `pnpm dev`, no sign-in needed):

| Template | Shows |
| --- | --- |
| `/dev/templates?open=profile-filled` | Member with everything set, active membership, locked student number |
| `/dev/templates?open=profile-new` | Signed up and skipped setup: initials, nothing optional set, dietary not answered |
| `/dev/templates?open=profile-saving` | Admin with a preset icon, photo chooser open, About you saved, Food saving |
| `/dev/templates?open=profile-error` | Non-member: About you failed to save (Retry works), invalid student number |
| `/dev/templates?open=profile-pending` | Pre-order: "Payment processing", student number locked |

Each also renders alone with `-frame` (e.g. `?open=profile-new-frame`), which is
what the 375px iframe shows; at a desktop window the frame is the dialog at its
real 1000 x 760. All of them work in dark mode. The templates run the real
`ProfileTab` with a fake autosave (800ms debounce, then 600ms).

Code:

- `src/features/settings/components/ProfileSettings.tsx`: `ProfileSettings`
  (the signed-in member, from `useUser`) and `ProfileEditor` (the wiring:
  state, validation and one autosave per section).
- `src/features/settings/components/profile/`: `ProfileTab` (the tab body,
  presentational), `ProfileHeader`, `ProfileSection`, `model.ts` (section
  ids, payloads, validation, membership summary, labels) and `client.ts` (the
  saves, behind an interface so tests run the real tab on fixtures).
- `src/app/dev/templates/profile.tsx`: fixtures, the fake autosave and a
  static copy of the dialog chrome.

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

1. About you: first and last name, pronouns and phone (the last three
   "Optional": a member with one name leaves the last name empty).
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
`src/components/ui` or `src/components/shared`. Gaps still open:

- **Shared autosave status.** `AutosaveStatus` (and `createAutosave`, which
  the tab now uses per section) live in `src/features/applications`, and the
  status announces "Your answers are saved." Promote both to shared code with
  the announcement copy as a prop (Profile wants "Your profile is saved."). The
  Profile tab imports them across features for now.
- **Disclosure / Collapsible.** There is no collapsible primitive, so the photo
  panel is a button with `aria-expanded`/`aria-controls` and a conditional
  region. Fine for one use; add a `Collapsible` (Radix) if a second appears.
- **Settings section layout.** `ProfileSection` (title column beside content,
  container-query sized) is the settings counterpart of `SettingsRow` for
  multi-field groups. If General or Purchase history grow sections, move it to
  `src/features/settings/components` beside `SettingsRow`.

## 4. How it is wired

`ProfileFields` and `SetupSettings` are gone; `ProfileSettings` renders
`ProfileEditor`, which feeds `ProfileTab`. The saves are the ones the old tab
made, unchanged on the server:

| Section | Saves through |
| --- | --- |
| About you | `updateUserInfoById` on the member's own row (RLS) |
| Studies | `updateEligibilityProfileAction` when the student number changed (it validates, and refuses while a membership is active or pending), then `updateUserInfoById` for the columns the account type owns |
| Photo | `saveSetupPhotoAction` for an icon; `POST /api/profile-photo` (`uploadProfilePhoto`) for an upload, inside the crop dialog |
| Food and allergies | `saveSetupDietaryAction` |
| Interests | `saveInterestsAction` (keeps managers' free tags) |

- **One autosave per section.** Each section runs its own `createAutosave`
  (the application form's controller): an 800ms debounce, one save in flight
  at a time, two quiet retries of a failed save, then "Couldn't save" with
  Retry beside that section. Retry moves focus to the section heading (the
  photo panel, for the photo) so it isn't lost when the button turns into
  "Saving…". Closing the dialog mid-debounce flushes what was changed.
- **Validation.** Errors show after blur and update as you type from then on.
  An empty name holds About you; a bad student number holds Studies; the rest
  keep saving. A student number is checked only while it is editable and
  differs from the saved one, so an old, oddly formatted number never blocks
  the rest of Studies.
- **Edits in progress survive a refresh.** The form starts from the row once;
  saving refreshes `useUser` for the rest of the app (sidebar avatar,
  membership pages) without resetting what's being typed.

Departures from §2 and §4 of the proposal:

- **"Membership ended".** A lapsed membership keeps its type id, so the
  proposal's summary would have called it current with a past "Until" date.
  The header now says "Membership ended" (neutral) with "Ended <date>".
- **Lock copy by reason.** A pre-order locks the student number with "Locked
  while your membership payment is processing", and the faculty email (always
  locked: it is the sign-in address) says so instead of blaming a membership.
- **Student-number copy stays in Settings.** Rather than changing
  `validateStudentNumber` (shared with membership join), Settings checks the
  length first ("Student numbers are 8 digits.") and defers to it after.
- **"No dietary needs" is saved as an answer.** On an unanswered profile,
  choosing it now writes the empty lists (and moves setup past dietary), so
  "Not answered" doesn't come back next time. The old tab skipped that write.
