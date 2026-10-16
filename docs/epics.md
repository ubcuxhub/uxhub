# Epics

Snapshot of the Notion [Epics](https://app.notion.com/p/3e52f9f09f188012b7eeeb4e6ddbb398)
board (2026-2027 / Engineering / Epics and Timelines), taken 2026-10-09. Notion
stays the source of truth. ⭐️ marks a priority feature. `[+]` in a structure
tree marks a path that doesn't exist yet.

| Epic | Owner | Due | Status |
| --- | --- | --- | --- |
| [Platform](#platform) | Jefferson Dermawan | Nov 12 | In progress |
| [Admin](#admin) | Bernard Liu | Nov 12 | In progress |
| [Applications & registration](#applications--registration) | talia feng | Nov 12 | In progress |
| [Event tickets](#event-tickets) | Fegico Chen | Nov 12 | In progress |
| [Student experience](#student-experience) | isabella linde | Nov 12 | In progress |
| hifi implementation | — | Dec 3 | Not started (page is blank) |

## Platform

CI test gaps, feature flags and deployments, and the audit log end to end: data,
backend, and the user activity feed UI.

- **⭐️ CI:** close the test gaps
  ([unit](ci-test-gaps-unit.md), [integration](ci-test-gaps-integration.md))
- **⭐️ DevOps:** feature flags and deployments
- **⭐️ Audit log, end to end:** the data, the backend and the user activity
  feed (sign-ups, account deletions, purchases) UI
  - **admin change log** tracks admin activities (e.g. edited a user's major,
    edited membership tier description)
    - written by Postgres DB trigger
    - surfaced in a "History" tab in the edit-event/edit-user drawers (UI built
      by Admin)
  - **user activity feed** tracks user-side events (e.g. membership/event
    purchase, new sign up, account deletion)
    - written by explicit calls in code
    - surfaced in the admin dashboard
  - **One shared table** (e.g. `audit_events`), two different views (change log
    vs activity feed)
  - When someone deletes their account, their entries show as "Deleted user"

```plain text
uxhub/
├── .github/, docs/, scripts/          CI, seed, tooling
├── supabase/                          schema, migrations, RLS tests
└── src/
    ├── features/[+] audit-log/        <ActivityFeed />
    └── lib/
        ├── log.ts, supabase/
        └── supabase-helpers/
            ├── tables, types
            └── [+] audit-log          incl. the history query for Admin's History tab
```

The Notion page also has an image that isn't reproduced here.

## Admin

Admin dashboard, edit-event and edit-user drawer refinement, history tabs in the
drawers (audit log UI), and CSV export.

- **⭐️ Admin dashboard:** stats and quick links, with spots for Platform's user
  activity feed (and maybe admin change log).
- **⭐️ Edit-event and edit-user layout unification** (refer to figma)
- **⭐️ Scheduled event publishing (new):** event status changes from `draft`
  to `active` at a specific time
- **UI for the admin change logs (part of audit log):** new "history" tab in the
  edit user and edit event drawers; reads Platform's admin change log
- **CSV export** of attendee and user lists: event attendees, and the user list
  with different filters applied
- **Club Settings** (`/admin/settings`): refinement

```plain text
src/
├── app/
│   ├── (app)/(shell)/admin/
│   │   ├── page.tsx                   dashboard
│   │   ├── events/                    list, edit, create-new
│   │   ├── users/ (+ [+] [userId]/)
│   │   └── settings/                  Club Settings
│   ├── @flow/[+] (.)admin/            edit-event and edit-user drawers (+ History tab)
│   └── api/upload-event-image/, [+] export/   CSV export
├── features/admin/                    except Application* / ReviewApplications* / CheckIn*
├── components/shared/[+] FlowDrawer
└── lib/supabase-helpers/
    └── users, app-settings, admin-server
```

## Applications & registration

Application form with registration gated on approval, admin review (approve,
reject, waitlist), reviewer notes, and decision emails later.

- **⭐️ Application form**, with registration opening only after approval
  - some events go through the application/review process (e.g. uxathon),
    others don't
- **⭐️ Admin review:** accept, reject, or waitlist.
  - **Accept by the deadline:** the offer expires
  - spots open up when offer expires, but waitlist advancement is not
    automatic. Admins manually approve people on the waitlist
- **⭐️ Reviewer notes:** a comment thread on the application review page, so
  execs can collaborate when reviewing applications
  - an admin can create, edit, and delete their own comments
- **Decision email (for later?):** a Tiptap (rich text) draft box with a
  preview, fitted into a predefined brand template, sent through Resend.
  What's the best design?
- Dropped: a "release your spot" button on the portal event page (paid users
  could re-register without repaying, no refunds).

```plain text
src/
├── app/(app)/(shell)/admin/events/[event]/review-applications/
├── features/
│   ├── admin/Application*, ReviewApplications*
│   └── [+] applications/              form, reviewer notes, decision email,
│                                      expire-offers job
└── lib/supabase-helpers/
    └── event-applications (+ notes)
```

## Event tickets

Event and membership checkout refinement, 2D tickets with the QR code, QR
check-in, and an Apple Pay spike.

- **⭐️ Checkout flow** for events and memberships (mostly refinements)
- **⭐️ QR check-in:**
  - generating and checking the codes
  - the scanner, only accessible on a phone (not laptop)
  - manual lookup when a code won't scan
  - scanning the QR code shows the person's name, and a second scan shows
    "Already checked in at 10:02"
  - the QR code appears on the ticket in the event page
  - a screenshot should work as well as the live code
- **⭐️ Tickets (2D)** with the QR code (on the event page): a ticket component
  that Student experience places on the portal event page; the three.js ticket
  wraps it
- Apple Pay? Is it possible with square on chrome?

```plain text
src/
├── app/
│   ├── (app)/(shell)/
│   │   ├── portal/events/[event]/checkout/
│   │   ├── portal/membership/[membership]/checkout/
│   │   └── admin/events/[event]/check-in/   scanner, manual lookup
│   ├── (app)/(confirmation)/          purchase confirmations
│   ├── @flow/(.)portal/events/, (.)portal/membership/[membership]/checkout/
│   └── api/square/webhook/
├── features/
│   ├── events/, payments/             checkout, [+] ticket
│   └── admin/CheckIn*
├── components/shared/CheckoutLayout, CheckoutPaymentSection
└── lib/
    ├── square/
    ├── email/templates.ts             receipts
    └── supabase-helpers/
        └── events, event-registrations, purchases, check-ins
```

## Student experience

Portal events timeline and event page, newsletter, three.js membership card and
ticket, marketing events pages, and the /design page.

- **⭐️ Portal events timeline:** upcoming and past, with search
  ([figma](https://www.figma.com/design/hzJM3bL3wYWNG5RvqH7RaT/UX-Hub-Portal?node-id=2131-4879))
  - highlighting of the currently happening event (or that's about to happen).
    Makes it easy for the user to find their event ticket and the QR code (for
    checkin)
- **⭐️ Portal event page**
  ([figma](https://www.figma.com/design/hzJM3bL3wYWNG5RvqH7RaT/UX-Hub-Portal?node-id=3733-13618)),
  could include: details, registration and payment status, the ticket with the
  QR code (built by Event tickets), spot for Google Drive link?, add to calendar
- **⭐️ Newsletter:**
  - toggle in settings
  - opt-in box at sign-up
  - Mailchimp sync, Mailchimp stays the source of truth (optional: tag members
    by membership type and events attended); our app simply mutates
    Mailchimp's record rather than keeping who's subscribed in the DB
- **three.js (e.g. shiny 3D) membership card and event ticket**, with a static
  fallback. The ticket shows the QR code
  ([figma](https://www.figma.com/design/hzJM3bL3wYWNG5RvqH7RaT/UX-Hub-Portal?node-id=3262-3246)).
  The "Event tickets" epic makes the first version of the event ticket (2D)
- **Marketing events pages:** refine `/events` and `/events/[slug]` (lightly,
  since we don't have hifi yet)
- (for later) the /design page and potential component library extraction: a
  new tab on the ubcuxhub.ca homepage showcasing our design system

```plain text
public/                                marketing images
src/
├── app/
│   ├── (marketing)/                   homepage, /events, /events/[slug]
│   ├── (auth)/                        + newsletter opt-in
│   ├── (app)/(shell)/portal/
│   │   ├── page.tsx                   portal home
│   │   ├── events/                    timeline, event page (checkout → Event tickets)
│   │   └── membership/                join flow (checkout step → Event tickets)
│   ├── @flow/(.)portal/membership/
│   └── [+] design/
├── features/marketing/, memberships/, events/, auth/, settings/
│                                      + three.js card and ticket, newsletter toggle
└── lib/
    ├── email/auth-templates.ts
    ├── [+] mailchimp/
    ├── flags.ts, theme.ts
    └── supabase-helpers/memberships, events
```

### Timeline

| Week | Dates | Work |
| --- | --- | --- |
| W1 | Oct 1-8 | events timeline: UI & pulling real events data (upcoming & past), current event highlighting |
| W2 | Oct 8-15 | events timeline: search + event not found; single event page: base UI, pull working data |
| W3 | Oct 15-22 (v busy, svsd + mt) | single event page: page variants based on status |
| W4 | Oct 22-29 | newsletter: toggle in settings, sync w mailchimp, opt-in box at sign up |
| W5 | Oct 29-Nov 5 | three.js membership card: implement, static fallback |
| W6 | Nov 5-12 (reading break) | refine /events; events timeline & single page: add motion |
| Later | after Dec 3 | /design component page |
