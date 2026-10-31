# Portal design system

Condensed index of the Figma file
[1.0 Portal Design System – UBC UX Hub](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/1.0-Portal-Design-System-UBC-UX-Hub)
(v1.0, last updated Oct 27, 2026; snapshot taken 2026-10-30). Figma stays the
source of truth. Page links open the page's main frame. Section 6, "How to use
in Claude Design", is left out.

## Contents

| # | Page | |
| --- | --- | --- |
| 1.1 | [How to read this file](#11-how-to-read-this-file) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-4959) |
| 2.1 | [Colour](#21-colour) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5077) |
| 2.2 | [Typography](#22-typography) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5364) |
| 2.3 | [Layout grid](#23-layout-grid) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5548) |
| 2.4 | [Spacing and density](#24-spacing-and-density) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5681) |
| 2.5 | [Radius and stroke](#25-radius-and-stroke) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5766) |
| 2.6 | [Elevation](#26-elevation) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5837) |
| 2.7 | [Iconography](#27-iconography) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-5874) |
| 2.8 | [Motion](#28-motion) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-6271) |
| 2.9 | [Writing and terminology](#29-writing-and-terminology) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-6331) |
| 2.10 | [Accessibility](#210-accessibility) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-6548) |
| 2.11 | [Figma variables](#211-figma-variables) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-6724) |
| 2.12 | [Dark mode](#212-dark-mode) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-7664) |
| 3.1–3.17 | [Components](#3-components) | see table |
| 4.1–4.5 | [Patterns](#4-patterns) | see table |
| 5.1–5.2 | [Branding](#5-branding) | see table |
| 0 | [Library page](#library-page-0) | [Figma](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=0-1) |

---

## 1.1 How to read this file

- The file documents everything the portal is built from and is the source of
  the Figma library. Work through Foundations first.
- Every page has the same layout: header (location left, section number
  right), title (the name as in Figma and code), one- or two-sentence intro,
  examples (variants, states, sizes), then grey rule cards.
- Conventions:
  - Green frames are Do, red frames are Don't.
  - `[BRACKETED TEXT]` is content still to come. Never ship it.
  - Sample names, numbers and dates are made up.
  - `lowercase-hyphenated` names are tokens (Figma and CSS share them).
    `CapitalizedNames` are components (same in Figma and React).
  - 3.10–3.16 are drawings of components not yet in the library.
- House rules: Canadian English; Title Case for navigation and page titles,
  sentence case everywhere else; white pages; content starts 40px from the
  top, level with the X logo; buttons, fields, badges and tags are pills;
  Lucide icons at 1.5px.

## 2. Foundations

### 2.1 Colour

Calm neutral surfaces, one blue for action. Screens use semantic tokens only;
primitives exist for aliases and brand moments.

| Token | Light | Use |
| --- | --- | --- |
| `background-default` | #FFFFFF (neutral-0) | Page |
| `background-secondary` | #F8F8FA (neutral-100) | Secondary areas, list rows |
| `background-surface-card` | #FFFFFF | Cards, panels, dialogs |
| `background-surface-subtle` | #F1F2F5 (neutral-200) | Skeletons, placeholders, selected nav |
| `background-surface-hover` | #FCFCFC (neutral-50) | Hover on rows and nav |
| `text-primary` | #111111 | 18.9:1 on white |
| `text-secondary` / `text-muted` | #5F6368 | 6.0:1 on white / 5.4:1 on subtle |
| `text-disabled` | #5C6A7C | 4.6:1 on disabled fill |
| `text-inverse` | #FFFFFF | On primary |
| `border-default` | #D9DCE3 | Edges |
| `border-subtle` | #E8EAF0 | Dividers |
| `action-primary` | #325DC4 (blue-500) | The only filled action |
| `action-primary-hover` / `-strong` | #2A4DA0 / #192F63 | Hover / pressed |
| `action-secondary` | #FFFFFF | With `border-default` |
| `action-focus` | #5F81D1 (blue-300) | 3.8:1 focus ring |
| `action-destructive` | #F62D2D (red-500) | 3.9:1, bold or large labels only |
| `action-destructive-hover` / `-strong` | #D11D1D / #AC0000 | Hover / pressed |
| `action-disabled-background` / `-border` | #E8EAF0 / #D9DCE3 | Disabled |

Status (always text on its own background, always with a word):

| Tone | Text on background | Contrast | Example |
| --- | --- | --- | --- |
| Success | #166534 on #DFFCE9 | 6.5:1 | Going. Active marks #00A33E |
| Warning | #92400E on #FEF3C7 | 6.4:1 | Waitlisted |
| Error | #B42318 on #FEE4E2 | 5.5:1 | Full; also field errors |
| Info | #1D4ED8 on #DBEAFE | 5.5:1 | Accepted; also action banner tint |

- **Brand gradient:** blue-500 → purple-500, top to bottom. Sign-in panel,
  membership card, marketing. Never on an event.
- **Event colours:** organizers set a header colour and an event colour,
  from presets (Blue #325DC4, Orchid #C983C7, Slate #4A5E8A) or any colour.
  Header colour is a flat fill when there's no header image. Event colour fills
  the ticket (45% white tint at top → event colour at bottom) and the featured
  Home card (135°, event colour → tint). Keep text off event colours, except
  the ticket: white or `text-primary`, whichever contrasts more.
- Dialogs sit on `overlay-scrim` rgba(17, 17, 17, 0.4).

### 2.2 Typography

One family, **DM Sans**, weights 400/500/600, 13 text styles; every line
height on the 4px grid.

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `header-1` | 32 / 40 | 600 | Sign-in heading, member home greeting |
| `header-2` | 24 / 32 | 600 | Page titles, timeline months |
| `header-3` | 20 / 28 | 600 | Page sections, dialog titles |
| `subheading` | 18 / 26 | 500 | Card and panel titles |
| `body` | 16 / 24 | 400 | Copy, inputs, sidebar items |
| `body-medium` | 16 / 24 | 500 | Form labels, emphasis |
| `body-small` | 14 / 20 | 400 | Metadata, helper text |
| `table-text` | 14 / 20 | 400 | Table cells |
| `table-heading` | 16 / 24 | 500 | Column headings |
| `button` | 16 / 24 | 500 | Button labels |
| `button-small` | 14 / 20 | 500 | Small buttons |
| `label` | 13 / 18 | 500 | Chips, tags, counts, sidebar group labels |
| `status-label` | 12 / 16 | 500 | Status badges |

No all caps or letter-spacing anywhere. Marketing only: `display-xl` 56/64 and
`display-lg` 40/48, never in the portal.

### 2.3 Layout grid

| Style | Width | Frame | Columns | Margin | Gutter | Top spacing | Chrome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop | ≥1024 | 1440 | 12, stretch | 64 | 32 | 40, level with the logo | 256px sidebar |
| Tablet | 600–1023 | 768 | 8, stretch | 24 | 32 | 40 | 88px collapsed sidebar |
| Mobile | ≤599 | 390 | 4, stretch | 20 | 16 | 32 below the app bar | 56px app bar, menu in a drawer |

- The first thing in the content area (action banner, back pill or title)
  starts 40px from the top. Page actions like Publish sit in the title row,
  never above it. No header bar fills the space. Sidebar-less screens (Sign in)
  centre content.
- Side peek drawer top bars start at 40px too. Dialogs centre but stay ≥40px
  from the top; taller ones scroll inside.
- Content blocks span whole columns. Tables scroll sideways inside their card
  on small screens.

### 2.4 Spacing and density

4px scale: `space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-8` 32,
`-10` 40, `-12` 48, `-16` 64 (CSS `--space-*`).

| Density | Where | `size-control` | `size-table-row` | `size-nav-row` |
| --- | --- | --- | --- | --- |
| Comfortable | Member screens | 40 | 56 | 44 |
| Compact | Admin tables | 32 | 40 | 44 |

Set via the Density collection in Figma, `data-density` in code. Touch targets
stay ≥44px on mobile.

### 2.5 Radius and stroke

Everything clickable or typeable is a pill; containers soften as they grow.

| Token | px | Use |
| --- | --- | --- |
| `radius-none` | 0 | Images flush to a card top |
| `radius-xs` | 2 | Tiny marks |
| `radius-sm` | 4 | Checkboxes |
| `radius-md` | 6 | Nav rows, menu items |
| `radius-lg` | 8 | Event cards, list rows |
| `radius-xl` | 12 | Cards, panels, banners, toasts |
| `radius-2xl` | 16 | Dialogs, sign-in card, tables, popovers |
| `radius-3xl` | 24 | Event thumbnails, large media |
| `radius-4xl` | 32 | Hero media |
| `radius-full` | 999 | Buttons, inputs, chips, tabs, avatars, badges, tags |

Stroke: `thin` 1px (default borders), `medium` 1.5px (emphasized outlines,
all icons), `thick` 2px (focus rings, selected states).

### 2.6 Elevation

Borders separate surfaces, not shadows.

| Level | Surface | Treatment |
| --- | --- | --- |
| 0 | Page | `background-default`, no border or shadow |
| 1 | Card | `border-default` only; hover changes border/fill, never lifts |
| 2 | Menus, tooltips, toasts | Border + `shadow-overlay` |
| 3 | Dialog | Border + `shadow-overlay` + `overlay-scrim` |

`shadow-overlay`: `0 1px 2px rgba(17,17,17,.04), 0 4px 16px rgba(17,17,17,.06)`.
Never stronger, no coloured shadows, glows or neon focus.

### 2.7 Iconography

Lucide (`lucide-static` 1.55.0; `lucide-react` in code), 1.5px stroke.

- **Sizes:** 16px beside 16px text (8px gap, centred); 14px beside small text.
  Icon-only buttons are 28–32px circles with a `border-subtle` edge, an
  accessible label and a tooltip.
- **Colour:** `text-secondary` by default; status colour inside badges.
- Decorative icons have no hover/pointer and are hidden from screen readers.
- No emoji. No brand icons: use the company's own logo file (e.g. LinkedIn).

| Area | Mapping |
| --- | --- |
| Navigation | `house` Home · `calendar` Events · `layout-dashboard` Dashboard · `calendar-check` Manage Events · `users` Manage Users · `list` Change Log · `user` Profile · `log-out` Log Out · `panel-left-close`/`-open` sidebar · `arrow-left` back pill |
| Event details | `calendar` date · `clock` time · `map-pin` venue · `link` links · `globe` website · `mail` email · `ticket` ticket · `qr-code` ticket code · `image` placeholder · `upload` upload |
| Status badges | `hourglass` Pending/Waitlisted · `circle-alert` Accepted · `circle-check` Going · `user-check` Checked in · `lock` Full · `circle-minus` Not selected |
| Actions | `search` · `plus` · `pencil` · `trash-2` · `ellipsis` · `x` · `check` · `chevron-down/left/right` · `list-filter` · `download` · `external-link` · `eye`/`eye-off` |
| Feedback | `circle-check` success · `circle-alert` error · `triangle-alert` warning · `info` info |

### 2.8 Motion

One curve, ease-out `cubic-bezier(0, 0, 0.2, 1)`; never linear or bounce.

| Duration | Use | What changes |
| --- | --- | --- |
| 150ms | Hover/press on buttons, rows, chips, nav | Fill and border colour only |
| 200ms | Menus, tooltips, dialogs, expanding panels entering | Fade + short slide or scale |
| 250ms | Toasts entering | Fade + slide from the edge |

Reduced motion keeps only fades. Cards never lift. Buttons show progress in
place; content loads into shaped skeletons.

### 2.9 Writing and terminology

**Voice:** clear not corporate; ambitious not intimidating; playful not
chaotic. Strictly functional for payments, applications, errors, registration,
account info, destructive actions and admin. Personality only in low-risk
moments (empty states, welcomes).

- Canadian English. "UBC UX Hub" first, then "UX Hub" (never "UXHub"/"UX HUB").
  Always UXathon, Figma, FigJam. No emoji.
- Title Case: page titles, main sections, sidebar nav, named features. Sentence
  case: buttons, headings, card titles, labels, helper text, messages, table
  headings, badges. Never all caps.
- No full stops on buttons, nav, labels, badges, short headings. Serial comma;
  "and" not "&". Rare exclamation marks, never in functional messages.
  Ellipsis only for in-progress actions ("Saving…"). En dashes for ranges only;
  no em dashes in headings, hero lines or buttons.
- Dates `August 19, 2026` / `Aug 19`; times `7:00 PM`, `7:00–8:30 PM`,
  `Jan 9–10`; add "PT" for non-local audiences; numerals for anything scanned.

| Term | Use |
| --- | --- |
| Portal | The product. "Go to portal" |
| Dashboard | Admin overview page only, never the whole portal |
| Member / User | Member in member-facing copy; User only in admin/system contexts |
| Applicant / Attendee / Registrant | Application review / event and check-in / admin only (status always "Going") |
| Membership | Explorer, Innovator, Faculty, Non-UBC. Never "tier" or "plan" |
| Application | Never "registration" while a decision is pending |
| Registration | A reserved or confirmed spot |
| Purchase | When payment is involved; never "register" while payment is needed |
| Check-in / check in | Noun-adjective / verb |

Nav labels never change: Home, Events (members); Dashboard, Manage Events,
Manage Users, Change Log (admins).

Interface copy: buttons are a 1–3 word verb, same verb everywhere (not
"Continue/Submit/Yes"). Visible labels; placeholders give examples; mark the
few optional fields "Optional". Filters are nouns matching table headings. One
word per status. Empty states say what's missing and what happens next.
Success confirms without celebration. Errors say what went wrong and how to fix
it, without codes. Confirmation dialogs: the action is the title
("Delete event?"), the body states the consequence. Links name the
destination, never "Click here".

### 2.10 Accessibility

WCAG 2.2 AA.

| Area | Target |
| --- | --- |
| Text contrast | 4.5:1; 3:1 at ≥24px or ≥19px bold |
| Non-text contrast | 3:1 for control borders, focus rings, icons, chart marks |
| Focus | Visible 2px `action-focus` ring, never removed |
| Target size | ≥24×24; 44px for primary touch targets |
| Keyboard | Everything works without a mouse (Tab, Enter/Space, arrows, Esc returns focus to trigger) |
| Status | Never colour alone: word + icon where space allows |
| Motion | No essential info in animation |
| Content | Labels name the action, alt text, states say what to do next |

Known gaps from the contrast table: white on `action-destructive` (3.9:1) is
large/bold text only; `border-default` on white is 1.4:1, below 3:1 for input
outlines.

Before shipping: labels and accessible names, icon-button tooltips, sensible
focus order, statuses readable in greyscale, alt text, errors beside fields,
works at 200% zoom and phone width.

### 2.11 Figma variables

Figma name = code name with the first hyphen as a slash
(`action/primary` ↔ `--action-primary`).

| Collection | Modes | Contents |
| --- | --- | --- |
| Colour Primitives | Value | 49 raw colours (`--colour-<hue>-<step>`): neutral, blue, purple, green, yellow, red, dark. Hide from publishing |
| Colour Tokens | Light, Dark | 36 semantic tokens, each aliasing a primitive; `overlay/scrim` is raw |
| Radius Tokens | Value | `radius/none` … `radius/full` |
| Stroke Tokens | Value | `thickness/thin`, `medium`, `thick` (`--stroke-thickness-*`) |
| Spacing Tokens | Value | `space/1` … `space/16` |
| Density | Comfortable, Compact | `size/control`, `size/table-row`, `size/nav-row` |
| Icon colour | 10 modes | `icon/colour` → text and status tokens per mode |

Text styles map to classes (`Headers/Header 1` → `.header-1`, …,
`Badge/Labels/Status Label` → `.status-label`). Effect style `Shadow/Overlay` →
`--shadow-overlay`.

Rules: bind every fill, stroke, radius, gap and padding to a variable (a raw
hex or typed number is a bug); screens use Colour Tokens only.

### 2.12 Dark mode

Every colour token has Light and Dark values; set `data-theme="dark"` in code
or switch the Colour Tokens mode in Figma.

| Token | Light | Dark |
| --- | --- | --- |
| `background-default` / `surface-card` | #FFFFFF | #111111 |
| `background-secondary` / `surface-modal` | #F8F8FA / #FFFFFF | #1B1C20 |
| `background-surface-subtle` | #F1F2F5 | #25272C |
| `background-surface-hover` | #FCFCFC | #17181B |
| `text-primary` | #111111 | #F4F5F7 |
| `text-secondary` / `muted` | #5F6368 | #A8AEB8 |
| `text-disabled` | #5C6A7C | #9AA1AC |
| `border-default` | #D9DCE3 | #666C78 |
| `border-subtle` | #E8EAF0 | #30333A |
| `action-primary` | #325DC4 | #325DC4 |
| `action-primary-hover` | #2A4DA0 | #3F68D0 |
| `action-primary-strong` | #192F63 | #2A4DA0 |
| `action-focus` | #5F81D1 | #89A4E4 |
| `status-success-text` / `-background` | #166534 / #DFFCE9 | #6EE7A0 / #0F2E1C |
| `status-warning-text` / `-background` | #92400E / #FEF3C7 | #FCD34D / #2E2410 |
| `status-error-text` / `-background` | #B42318 / #FEE4E2 | #FCA5A5 / #3A1414 |
| `status-info-text` / `-background` | #1D4ED8 / #DBEAFE | #93B4F5 / #172554 |
| `transaction-positive` | #00A33E | #6EE7A0 |
| `transaction-negative` | #B42318 | #FCA5A5 |
| `overlay-scrim` | rgba(17,17,17,.4) | rgba(0,0,0,.6) |

Cards stay the page colour with a border; rows, menus and modals step up a
shade; hover lightens instead of darkening. Brand gradient, event colours,
Hubbo and the white logo don't change. Contrast on the dark page: primary
17.3:1, secondary 8.5:1, status text >7:1, edges 3.6:1.

## 3. Components

| # | Page | Components | Figma |
| --- | --- | --- | --- |
| 3.1 | Buttons | `Button`, `IconButton`, `Spinner` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-8108) |
| 3.2 | Form controls | `TextInput`, `Select`, `SegmentedToggle`, `Checkbox`, `Switch` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-8202) |
| 3.3 | Status badges and filter chips | `StatusBadge`, `FilterChip` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-8338) |
| 3.4 | Navigation | `Sidebar`, `SidebarItem`, `Tabs`, `Tab`, `Pagination` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-8672) |
| 3.5 | Cards | `Card`, `EventCard`, `StatCard` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-8849) |
| 3.6 | Table | `Table`, `Table/Cell` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-8926) |
| 3.7 | Overlays | `DropdownMenu`, `Tooltip`, `Dialog` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-9111) |
| 3.8 | Feedback | `Toast`, `ActionBanner`, `EmptyState` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-9202) |
| 3.9 | Avatars and event timeline | `Avatar`, `AvatarGroup`, `EventTimeline` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=112-4) |
| 3.10 | Colour picker | `ColourSwatch`, `ColourPicker` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-9396) |
| 3.11 | Date and time fields | `DateTimeField`, `DatePicker`, `TimePicker` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-9530) |
| 3.12 | Textarea, radio, image upload | `Textarea`, `Radio`, `ImageUpload` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-9789) |
| 3.13 | Searchable dropdown | `SearchableDropdown` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-9952) |
| 3.14 | Section navigator | `SectionNavigator` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-10073) |
| 3.15 | Side peek drawer | `SidePeekDrawer`, `DetailRow`, `TransactionRow`, `Tag`, `GhostIconButton` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-10231) |
| 3.16 | Table toolbar and selection | `TableToolbar`, `SearchField`, `SortFilterPanel` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-10724) |
| 3.17 | Slider | `Slider` | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=160-5) |

### 3.1 Buttons

- Variants: **Primary** (`action-primary` fill, white label; one per view),
  **Secondary** (white, `border-default`; everything else), **Destructive**
  (only inside a confirming Dialog).
- Sizes: md 40px (forms, pages), sm 32px (cards, tables, toolbars). States:
  Default, Hover, Pressed, Focus, Disabled, Loading (keeps width, progress in
  place). Optional 16px leading/trailing icon, 8px gap.
- Label names the result ("View ticket"); never bare "Get started",
  "Learn more" or "Submit". Hover/press change fill to `-hover`/`-strong` in
  150ms; no lift, glow or scale.

### 3.2 Form controls

- **TextInput:** pill, 44px tall, label in `body-medium` above. States Default,
  Filled, Focus, Error, Disabled; optional leading icon and label action
  ("Forgot password?").
- **Select:** one choice from five or more. For two to four, SegmentedToggle or
  radio cards.
- **SegmentedToggle:** 2–3 options; switches a view, never submits.
- **Checkbox:** saved with the form; supports Indeterminate and a description.
- **Switch:** takes effect immediately; thumb shows a check when on.
- Labels always visible (placeholder is a hint; passwords have none). Errors in
  `status-error-text` under the field after blur or submit, explaining the fix.
  2px `action-focus` ring.

### 3.3 Status badges and filter chips

Badges report state (not clickable); chips filter a list and toggle.

| Badge | Tone | Means |
| --- | --- | --- |
| Registration open | success | Taking registrations or applications |
| Going | success | Confirmed spot |
| Checked in | success | Ticket scanned at the door |
| Accepted | info | Accepted; member still confirms |
| Pending | warning | Applied, decision not released |
| Waitlisted | warning | On the waitlist |
| Full | error | No spots left |
| Not selected | neutral | Not accepted this time |
| Past | neutral | Event has ended |

Every badge has a 14px icon and a label; one badge per item (current status
only). Sizes Default and Large. FilterChips (optional count, Selected, Disabled)
combine, sit above the list in one row with any Select.

### 3.4 Navigation

- **Sidebar:** 256px, 88px collapsed. Members see the Browse group (Home,
  Events); admins also see Admin (Dashboard, Manage Events, Manage Users,
  Change Log). Profile, Log Out, Collapse Sidebar at the bottom. Selected item:
  `background-surface-subtle` at `radius-md`, no underline, bar or bold-only.
  16px icon in `text-secondary`, 8px gap. Group labels use `label`, sentence
  case.
- **Tabs:** sections of one object (Overview, Registrations 128, Teams 32,
  Judges); counts in `text-secondary`.
- **Pagination:** inside the Table's Card, "Showing 1–10 of 48 · Page 1 of 5".

### 3.5 Cards

- **Card:** white, `border-default`, `radius-xl`, never lifts or shadows. Title
  in `subheading`, description `body-small`, actions top right, footer actions
  bottom.
- **EventCard:** title, venue, date line(s), one StatusBadge, square thumbnail;
  the whole card is one link.
- **StatCard:** Value (with change), Rate (always with its count, "78% · 412 of
  528 registrants"), Not enough data (instead of 0), Loading. Change is neutral
  (arrow + words), never green up / red down.

### 3.6 Table

Admin lists. Filters above; Table and Pagination share one Card.
`table-heading` headers, `table-text` cells; empty cells show an en dash read
as "None". Loading: skeleton rows, never a spinner. Empty: plain-words message
(EmptyState when the whole page is empty).

### 3.7 Overlays

Border + `shadow-overlay`, enter in 200ms.

- **DropdownMenu:** every admin action on an object; destructive items last,
  after a divider, and open a Dialog. Optional shortcut (⌘E).
- **Tooltip:** names icon-only buttons; after 300ms on hover/focus; never
  essential info.
- **Dialog:** confirms destructive or blocking steps. Title asks the question
  ("Delete UXathon?"), buttons name both outcomes ("Keep event" / "Delete
  event"). Esc closes.
- Keyboard: Enter opens, arrows move, Esc closes and returns focus. One overlay
  at a time. Outlines survive high-contrast mode.

### 3.8 Feedback

- **Toast:** bottom right, stacked, 380px, auto-dismiss after 5s. Tones Success,
  Neutral, Error; optional action ("Try again"). Every admin result gets one.
  Text only, no Hubbo.
- **ActionBanner:** top of Home or an event page, one at a time; button names
  the step ("Confirm spot").
- **EmptyState:** say what goes here and offer the next step; no error colours,
  no blame. Hubbo may appear at card size (never on payments or rejections).

### 3.9 Avatars and event timeline

- **Avatar:** sizes 24/28/32/40/56/64; photo or up to two initials; always
  round; name is the accessible label.
- **AvatarGroup:** up to four faces then "+N", paired with words
  ("Team Pixel · 6 members").
- **EventTimeline:** month in `header-2`, date marker on a vertical rail, then
  an EventCard. "Jan 9", ranges "Jan 9–10", "9:00 AM–7:00 PM".

### 3.10 Colour picker

Sets an event's header and event colours in the event builder.

- Swatch: 44px circle, 1px rgba(17,17,17,.12) edge. Selected: 2px white gap +
  2px `text-primary` ring, `aria-pressed`. Custom colours join after the
  presets with a 22px remove button. Dashed "Add" circle opens the custom
  popover (colour wheel + Hex field, "Use a 6-digit hex, like #325DC4.").
- Presets in order: Blue #325DC4 (default), Orchid #C983C7, Slate #4A5E8A.
  Removing the selected custom colour reverts to Blue.
- Swatches and hue slider are focusable; the hex field is the keyboard way to
  set an exact colour.

### 3.11 Date and time fields

- Type or pick. On blur, input is tidied to "Sat, Nov 14, 2026" and "9:00 AM".
  A time without AM/PM reads as PM; an end time takes the first match after the
  start.
- Date popover: selected day `action-primary` fill; today a `border-default`
  ring; out-of-range days `text-disabled`. Error: "Use a real date, like Nov 14."
- Time list: 15-minute steps; end-time options show duration ("2 hr 15 min");
  "Pacific Time" footer. Error: "End time is before the start time."
- One row per event day; "Add another date" for multi-day.
- 40px pill like TextInput; popovers `radius-2xl`, `border-default`,
  `shadow-overlay`. Enter accepts, Esc closes, focus returns.

### 3.12 Textarea, radio buttons and image upload

- **Textarea:** TextInput styling with `radius-2xl`; counter ("84/280") only
  when there's a limit.
- **Radio:** 2–5 options compared at a glance (else Select or searchable
  dropdown). Selected = `action-primary` ring and dot. One group per question,
  question as legend.
- **ImageUpload:** states Empty ("Upload image · Or drag one here. JPG or PNG,
  1600 × 400 px or larger"), Dragging, Uploading (progress %, Cancel upload),
  Uploaded (Replace), Error ("That file is a GIF. Upload a JPG or PNG.").
- Nothing auto-submits; the page's Save or Publish does.

### 3.13 Searchable dropdown

For long searched lists (members, venues, sponsors); short fixed lists use
Select. States: Closed (placeholder names what's searched), Typing (matching
letters bold, highlighted row on `surface-subtle`, "3 matches · ↑↓ to move,
Enter to choose"), No results ("No members match "xyz"" + another way to find
it), Chosen (clear button), Multiple (removable chips; Backspace removes the
last). ARIA combobox/listbox/option; result count announced. 40px pill field;
menu `radius-2xl`, rows `radius-lg`.

### 3.14 Section navigator

Floating pill for long forms like the event builder ("04/09 · Registration ·
1 issue"); its ring fills with progress. Opens a menu above listing every
section with a state mark: Complete, Needs attention (with count), Not started
(required), Optional. Progress counts required sections only. Choosing a row
scrolls there and closes. Enter/Space opens, arrows move, Esc returns focus.

### 3.15 Side peek drawer

- Shows one record beside its list (e.g. Manage Users). Opens from the right
  over the page at 560px; the row stays highlighted; the table stays
  scrollable; another row swaps the content. Doesn't dim the page (use a Dialog
  when a decision is required).
- Top bar at 40px: double-chevron close first (tooltip names action and
  shortcut; Esc closes), "Open as full page" (own page with back pill).
- Viewing: label/value text rows, not disabled inputs. Editing: fields with a
  pinned Cancel / Save changes footer; closing with unsaved changes asks first.
- Profile header: name in 24/32 with verified icon and pronouns. Interests are
  read-only outlined Tags (not FilterChips).
- TransactionRow: charges/refunds "−$15.00" in `transaction-negative`; credits
  "+$100.00" in `status-success-text` (because `transaction-positive` is 3.3:1
  on white); tabular numbers.
- Focus moves to the name on open, back to the row on close. No Hubbo.

### 3.16 Table toolbar and selection

- Default: SearchField fills the width; "Sort and filter" on the right. No
  Select button: bulk-action tables always show a checkbox column.
- Searching filters as you type; clear button once there's text.
- Rows selected: Sort and filter is replaced by "2 selected", bulk actions
  (Export to CSV) and Clear selection. Header checkbox selects the current
  results.
- Checkbox selects (own 44px hit area); clicking elsewhere on the row opens the
  drawer.
- Export follows the view: selected rows, or all current results if none.
- Wide tables scroll sideways inside the card with a fade; first column stays
  put; long values ellipsize.
- SortFilterPanel: popover; filters apply as picked; button shows the count
  ("Sort and filter · 2"); footer "Clear all · 12 users".

### 3.17 Slider

Pick a value by dragging, e.g. photo zoom in the crop dialog (100–300%, 10%
steps, opens at 100%). Track 6px `radius-full` `border-default`; fill
`action-primary`; 20px white thumb with 2px `action-primary` edge; focus ring
2px `action-focus` 4px out; disabled on `action-disabled-background`. Value
always shown right ("140%", `body-small`, `text-secondary`, 44px wide). Native
range input (arrows ±1 step, Page Up/Down ±10, Home/End); 44px touch hit area;
live preview while dragging.

## 4. Patterns

| # | Page | Figma |
| --- | --- | --- |
| 4.1 | Lists: judges, mentors and sponsors | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-11019) |
| 4.2 | Sponsor logos | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-11132) |
| 4.3 | Status lifecycle | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-11707) |
| 4.4a | Template: Home | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-11971) |
| 4.4b | Template: Events | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-12079) |
| 4.4c | Template: Event detail | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-12285) |
| 4.4d | Template: Sign in | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-12588) |
| 4.4e | Template: Event builder | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-12634) |
| 4.4f | Template states | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-12995) |
| 4.5 | Back navigation | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-12881) |
| 4.6a/b | Starters: Member page, Admin page (on the Patterns cover page) | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=87-1768) |

### 4.1 Lists: judges, mentors and sponsors

Event overview sections (organizer-named, e.g. Judges, Mentors, Sponsors), each
a card with heading, count ("Displaying 3 judges"), divider, then rows. Row:
`background-secondary`, 1px `border-subtle`, 8px radius, 16px padding, 20px
apart. Lead is a 64px Avatar (people) or logo on a 64px white tile
(organizations). Name 18px medium; role · company or one-line description in
`body-small` `text-secondary`. Optional right-aligned link (LinkedIn,
Portfolio, Website) labelled with the person ("Alex Chen on LinkedIn"). One
column on every screen. No sponsor tiers.

### 4.2 Sponsor logos

Grid of equal tiles linking to sponsor sites: 112px tall, `border-subtle`,
`radius-xl`, logo inside a centred 120×48 box. 5 across desktop, 3 tablet,
2 mobile. Balance by optical size; no sizing by importance, no recolouring,
always on white tiles. Use the sponsor's SVG or large transparent PNG as
supplied. Tile label is the sponsor name; logo alt is empty. Never the UX Hub
logo or Hubbo in the grid.

### 4.3 Status lifecycle

- Event states (Registration open, Full, Past) show until a member has their own
  status. Member statuses (Pending, Accepted, Waitlisted, Not selected, Going,
  Checked in): show only the current one.
- Flows: open RSVP → Going directly. Application → Pending → Accepted (confirm
  by deadline) → Going → Checked in → Past; or Waitlisted (spot opens →
  Accepted) or Not selected. Innovators applying to UXathon are accepted on
  submit and confirm without paying. Missed confirmation deadline:
  `[TBD in Figma]`.
- Only Accepted gets an action banner (the only status with a deadline).
  Badges stay short.

| Status | Banner / card copy | Button | Email |
| --- | --- | --- | --- |
| Registration open | Price, capacity, sign-up deadline | Register for event · Submit application | — |
| Pending | "Application submitted. We'll email you when decisions are out." | View application | [APPLICATION RECEIVED] |
| Accepted | Banner: "You're accepted to Design Sprint. Confirm your spot by [DATE]." Greyed ticket + confirm-by date | Confirm spot | [YOU'RE ACCEPTED] |
| Waitlisted | "You're on the waitlist. If a spot opens, we'll let you know right away." | — | [YOU'RE ON THE WAITLIST] |
| Not selected | "You weren't selected this time. Keep an eye out for future events." | View events | [APPLICATION UPDATE] |
| Going | "You're going to Design Sprint. Read the participant package before the event." Ticket with QR | View ticket | [REGISTRATION CONFIRMED] |
| Checked in | Ticket marked used; team and links stay available | — | — |
| Full | "This event is full. We'd love to see you at the next one." | — | — |
| Past | "This event has wrapped up. Revisit the highlights in the photo album." | Open photo album | [EVENT RECAP] |

### 4.4 Templates

- **Home (4.4a):** "Hello, John" + "Here's what's coming up at UX Hub."; join
  banner for non-members ("Become a member"); "What's happening" featured event
  card; membership card (name, type, perk line, "Show this card at the door.
  You still register for each event.", valid-until date); Applications card
  (e.g. hiring, apply-by date).
- **Events (4.4b):** Accepted action banner on top; "9 upcoming events";
  search; Upcoming/Past toggle; EventTimeline grouped by month with a badge per
  event.
- **Event detail (4.4c):** back pill; title + status badge; dates, times,
  venue + address; Event details (website link, description); Registration card
  (participant package, ticket with "View ticket"); Your team (0/4 members,
  empty state with Hubbo, Join a team / Create team); Agenda with week tabs and
  timed rows; Judges and Sponsors lists.
- **Sign in (4.4d):** centred card: "Sign in to the UBC UX Hub Portal.",
  Continue with Google, "or continue with email", email, password (+ Forgot
  password?), "Don't have an account? Sign up".
- **Event builder (4.4e):** back to Manage Events; title + Draft badge + "Saved
  2 minutes ago"; Preview / Save draft / Publish in the title row; numbered
  sections (01/09 Basics: name, thumbnail 600×600+, page header image or
  colour, event colour, live previews of header, featured card and ticket;
  02/09 Description…) with the SectionNavigator.
- **States (4.4f):** sidebar and page title stay put. Loading: shaped
  `surface-subtle` skeletons, no spinners, `aria-busy`. Empty: say what goes
  here + next step; Hubbo resting or curious at card size. Errors: what happened
  and what to do, keep loaded content; Hubbo thinking. A failed action on a
  loaded page keeps the page and shows a toast. Examples: "No upcoming events",
  "Nothing on right now", "No events match "portfolo"" (Clear search),
  "Couldn't load events" (Try again), "This event isn't available" (Back to
  Events), "Couldn't confirm your spot" (toast).
- **Starters (4.6a/b):** Member page: title row with secondary + primary
  actions; cards stacked 24px apart spanning whole columns (half width = 6
  columns). Admin page: StatCards, one filter row above the table, Table and
  Pagination in one Card.

### 4.5 Back navigation

Pill link at the top of every detail page: 40px tall, fully rounded, 20px side
padding, 1px `border-default` on white; 16px left arrow, 8px gap, label in
`body` `text-primary`. Hover fill `surface-subtle`; focus 2px `action-focus`
ring 2px out. A real `<a href>` to the parent, never `history.back()`. First
item on the page, 24px from neighbours, below any action banner. Always name
the parent ("Back to Manage Events"); never bare "Back", a plain text link, or
right-aligned.

## 5. Branding

| # | Page | Figma |
| --- | --- | --- |
| 5.1 | Logo | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-13151) |
| 5.2 | Mascot (Hubbo) [WIP] | [link](https://www.figma.com/design/1JFllaWKGIMb3hBOl5m2Py/?node-id=110-13298) |

### 5.1 Logo

- Lockups: Horizontal (default), Two-line, Stacked (sign-in card), Mark
  (sidebar 36px / 32px collapsed, favicons, avatars).
- Colours: Black #161616 (portal on light), White #FAFAFA (dark surfaces,
  gradient, photos), Gradient #3A5FC4 → #B67FC6 (marketing only, never the
  portal).
- Clear space ≥ ¼ of the mark's width. Minimums: horizontal 120px, stacked
  48px, mark 24px.
- Don't stretch, recolour or redraw; no black logo on dark.

### 5.2 Mascot: Hubbo [WIP]

- **Who:** friendly face of UX Hub; they/their; welcomes, encourages,
  celebrates; warm, upbeat, fearless, curious. Illustrator and master-file link
  still `[TBD]`.
- **Emotions** (only eyes and arms change): Welcoming (first sign-in,
  onboarding), Curious (browsing, exploring empty states, tips), Excited
  (announcements, applications open), Proud (spot confirmed, membership active,
  checked in), Thinking (help, hints, can't load / not found), Resting (quiet
  empty states, waitlisted or full). Head-only set below 64px.
- **Anatomy:** one X-shaped head/body; palette Hubbo purple #C289F5, outline
  #682D9D, overalls #305DC3 / shade #1D4093 / navy outline #0A2158, buttons
  #FEB916, cheeks #F589EE, eyes #000000. Styles: full colour, one colour, head
  only. Redraws must pass the silhouette test.
- **Body rules:** can change eyes, arms, even scale, style, and outfit (themed
  campaigns only). Never bend/stretch the X, always smile and cheeks, upright on
  a ground line.
- **Motion** (same ease-out): Wave 800ms, Look around 600ms, Cheer 700ms,
  Blink 150ms every 4–6s, Settle 300ms; each plays once, ≤1s total; reduced
  motion shows the still pose; never moves while someone reads or types.
- **Usage:** one per screen. Hero 200–320px, card/empty state 96–160px,
  smallest full body 64px, head only 24–48px (print ≥25mm / 10mm). Backgrounds:
  #FFFFFF, #F4F4F4, #F4EAFE, #111111. Kept apart from the X mark except the
  portal sidebar; never stands in for it.
- **Voice:** short, warm, never pushy; "I" only in their own speech bubble; at
  most one exclamation mark; no emoji, no guilt ("Don't miss out"). Hubbo adds
  one line on top of UX Hub copy, never replaces headings, buttons or statuses.
- **Where:** show on welcomes, inviting empty states, form tips, confirmations,
  announcements, errors / no results / not available, waitlisted or full,
  admin empty states, merch. Never on payments, checkout, receipts, refunds,
  private info (profiles, settings, Manage Users drawer) or rejections
  (Not selected).
- **By surface:** sign-up complete hero 240px; Home empty card 120px; form tips
  inline 32px; social at least a third of frame height.
- **Before you ship:** 10 checks covering master artwork, matching emotion,
  only eyes/arms changed, unchanged palette, upright and uncropped, one per
  screen, calm background, no X mark nearby, not on payment/rejection/private
  screens, copy short and warm.

## Library page (0)

The published components, grouped into frames: Icons (59 `Icon/<name>`
components: 57 Lucide icons plus `linkedin` and `google` marks), Actions, Form controls,
Badges/chips/tabs (incl. `BackPill`), Cards, Overlays and feedback, Navigation
and data, People and timeline, Pickers, Textarea/radio/upload, Search and
section navigation, Drawer and table toolbar (incl. `ListRow` with Person or
Organization lead), and Patterns parts (`Ticket`, `Hubbo/Placeholder`,
`Hubbo/Full body`, `Hubbo/Head`).

## Inconsistencies in the Figma file

- 2.11 says the Colour Tokens Dark mode is "[NOT READY]" and unused, and 2.12
  says to rename it; the file already has Light and Dark modes with values
  matching 2.12.
- 2.1 lists `text-muted` as 5.4:1 "on subtle" with the same hex as
  `text-secondary`.
- 1.1 says 3.10–3.16 are drawings not yet in the library, but the Library page
  already has components for all of them.
- Open placeholders: missed-confirmation outcome (4.3), email templates (4.3),
  Hubbo illustrations, illustrator name and master-file link (5.2).
