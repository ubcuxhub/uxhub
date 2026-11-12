# Seed

Reconciles a Supabase database to the fixtures in `data/`. Idempotent — run it
as often as you like.

```bash
pnpm seed                  # local: make the database match the seed data
pnpm seed --target=prod    # prod: add and update demo data, never delete
pnpm seed --dry-run        # print the plan, write nothing
pnpm seed --no-prune       # local: sync without deleting
pnpm seed --only=events    # storage | memberships | events | users
```

## Targets

The target defaults to `local`; `prod` has to be asked for with `--target=prod`.
Each target checks that its URL really is the environment it claims to be — a
mispaste fails instead of hitting the wrong project.

|                        | `local` (default)             | `prod`                          |
| ---------------------- | ----------------------------- | ------------------------------- |
| URL                    | `NEXT_PUBLIC_SUPABASE_URL`    | `SEED_PROD_SUPABASE_URL`        |
| Key                    | `SUPABASE_SECRET_KEY`         | `SEED_PROD_SUPABASE_SECRET_KEY` |
| Deletes stale rows     | yes, unless `--no-prune`      | **never**                       |
| Login fixtures         | yes                           | **never**                       |
| Crowd accounts         | yes                           | **never**                       |
| Membership tiers       | yes                           | **never** (edited in Club Settings) |
| Event status           | as written in `data/events.ts`| forced to `draft`               |
| `event-images` bucket  | created if missing            | must already exist              |

Both live in `.env.local`. The prod keys are deliberately not `NEXT_PUBLIC_*`:
the dev server reads the same file, and that prefix would inline a service-role
key into the client bundle.

### Why prod forces drafts

The public RLS policy on `events` is `using (status = 'active')`, so an active
row stays readable through the anon API even though the `studentEvents` flag
hides every page that renders it. Drafts are invisible to that policy and fully
visible to admins, which is who the prod demo data is for. Flip one to active by
hand when you want to check the public view.

Prod also expects its migrations to be applied already (`pnpm exec supabase db push`)
— the run fails with that instruction if the storage bucket is missing.

## What gets deleted (local only)

`pnpm seed` reconciles *to* its data, so it removes seed-owned rows the data no
longer describes. That is what makes event checkout re-testable: buy a ticket as
a fixture account, re-run the seed, and the purchase is gone.

Deletion is scoped by ownership, not by table:

| Prunable                                                  | Never touched                                       |
| --------------------------------------------------------- | --------------------------------------------------- |
| Events and membership tiers matched by slug                | Auth users and profiles created by hand              |
| Mentors, sponsors, check-in sessions, application questions| Purchases, tickets and applications owned by any other account |
| People sections, links, meeting details and agenda days of seed events | Teams owned by any other account                   |
| Purchases, tickets and applications owned by the fixture accounts, crowd included | Covers uploaded through the admin UI (`covers/`)     |
| Application files under a fixture account's folder that no kept answer names | Crowd-domain profiles somebody signed up with (they have an Auth user) |
| Crowd accounts `data/crowd.ts` no longer lists, with their tickets and applications |                                    |
| Teams the fixture accounts own or joined, other than `data/teams.ts`'s |                                               |
| Reviewer notes the fixture accounts wrote, other than `data/review-notes.ts`'s | Reviewer notes by any other account   |
| Cover images under the `seed/covers/` storage prefix       |                                                      |

An extra event survives if a non-fixture purchase points at it —
`purchases.event_id` is `on delete restrict`, so somebody else's ticket keeps
the event alive and the run says which. Same for mentors, sponsors, and tiers,
which are `restrict` from their link tables.

## Fixtures

`data/events.ts` — 18 events. `EVENT_PHASES` at the top is the index of what
each one is for. The biggest group is **purchasable**: upcoming, active,
registration open, and left unbought by every login fixture so event checkout
can be run repeatedly. A test fails if a login fixture's purchase ever lands on
one. The crowd may hold seats there (nobody signs in as it), but each
purchasable event keeps at least `PURCHASABLE_MIN_SEATS_LEFT` (3) seats free
after its tickets and open offers; `thinkbox-office-tour` sits at exactly that,
the nearly-full state. The rest cover past events, still active so members keep
their history, a closed registration window, a not-yet-open one, and:

| Phase | Event | State |
| --- | --- | --- |
| `happeningToday` | `design-jam-today` | Free, one day, started an hour before the run and lasting six hours, with door check-in open throughout. For "happening now" highlighting and check-in rehearsal: `student-innovator@example.com` holds an unscanned ticket, nine crowd tickets are already checked in. Times move with the run, so re-seed to bring it back |
| `soldOut` | `figma-basics-workshop` | Registration open, all 20 seats held by the crowd, so the badge reads "Full". One crowd purchase was canceled as sold out |
| `draft` | `ux-research-workshop` | Draft, no schedule |
| `scheduled` | `accessibility-audit-clinic` | Draft with `publish_at` three days out (17:00 UTC), the admin "Scheduled" state. The database's own publication job (20261027230347) is armed by the write and *will* publish it if the local database is still up then; the next run puts it back. `--target=prod` writes no `publish_at`, since that would undo the forced draft |

Beyond dates and prices, the fixtures fill in the event page:

| Event | Dates | Also seeds |
| --- | --- | --- |
| `design-sprint-past`, `design-sprint-upcoming` | Monday to the next week's Friday | 6-day agenda, Mentors, teams of 3–4, Slack and participant package links |
| `uxathon-past`, `uxathon-upcoming` | Saturday to Sunday | 2-day agenda, Mentors, teams of 2–4, links (the past one has a recap). The upcoming one is featured |
| `thinkbox-office-tour`, `portfolio-review-night`, `student-panel` | One day | A one-day agenda |
| `mentorship-program` | Ongoing | Teams open for two weeks, with going-only links |
| `industry-talk-ai-and-ux`, `student-panel` | — | Online, with meeting details |
| `industry-talk-design-systems` | — | Hybrid, with meeting details the three deep fixtures can see |

People sections are Mentors only until the builder reads other sections: it
saves every person on an event back as a mentor.

Agendas live in `event_agenda_days` and `event_agenda_items`, not the legacy
`events.agenda` column, which the fixtures still fill for the public page.

`data/teams.ts` — teams, made through `create_team` and `join_team` after the
accounts' tickets exist, so they follow the app's rules. The purchasable events
can't hold fixture tickets, so the one team lives on `mentorship-program`:
`admin-explorer@example.com` owns Pixel Pushers with `no-membership@example.com`,
and `student-innovator@example.com` holds a ticket with no team. A run keeps the
team's invite code and undoes team changes made through the app. Local only:
`--target=prod` writes no accounts, so no teams.

`data/review-notes.ts` — reviewer notes, the thread admins keep on an
application under review, on the crowd's `uxathon-upcoming` applications and
written by the admin login fixtures, so any admin you sign in as sees other
reviewers' notes. They cover a thread of three (Noah Fischer's), an edited note,
a long one cut at six lines (Isabel Costa's), notes on waitlisted, rejected and
accepted applications, and plenty of applications with none. One author is a
deleted account: a profile at `deleted+seed-former-reviewer@deleted.uxhub.invalid`
shaped the way `delete_account` leaves one, so its notes show as "Deleted user".
Times follow each application's `submitted_at`, fixed for the run's day. A run
matches notes on application, author and time, replaces one the data describes
differently, and deletes any other note a fixture wrote, such as one posted
through the review page. Local only: `--target=prod` writes no accounts, so no
notes.

`data/users.ts` — twelve local login accounts. **Password is `123456` for all of them.**
Ten cover every membership state crossed with the basic and admin roles:

| Membership | Non-admin                       | Admin                             |
| ---------- | ------------------------------- | --------------------------------- |
| Explorer   | `student-explorer@example.com`  | `admin-explorer@example.com`      |
| Innovator  | `student-innovator@example.com` | `admin-innovator@example.com`     |
| Faculty    | `faculty-member@ubc.ca`         | `admin-faculty@ubc.ca`            |
| Non-UBC    | `non-ubc@example.com`           | `admin-non-ubc@example.com`       |
| None       | `no-membership@example.com`     | `admin-no-membership@example.com` |

Every fixture but `admin-no-membership@example.com` and
`new-member@example.com` has a birthday and interest tags for the admin user
directory; the first is left empty so the dialog's empty state is visible. `student-explorer@example.com` is a verified student, verified
by `manager-no-membership@example.com`; everyone else is unverified. Each run
resets verification and profile photos to that, undoing changes made through
the admin dialog.

`manager-no-membership@example.com` is the dedicated manager fixture. It can
edit users and roles and is the only fixture that can access Club Settings.

`new-member@example.com` (basic, no membership) is the one account that has not
done member setup, so signing in lands on `/portal/setup` instead of the portal
home. Every other fixture has `setup_step = 'done'`, like the existing members
the setup migration backfilled. Each run puts it back at step 1 ("What best
describes you?", unanswered: `user_type_confirmed_at` null) with no
dietary needs, photo or interests, undoing setup done through the UI. Every
other fixture has answered (a fixed `user_type_confirmed_at`), so membership
join skips the question for them and goes straight to their details. Dietary
needs are structured (`diets`, `allergies`, `other_allergies`): two fixtures
and six crowd accounts have one.

The tier decides `user_type` — `isEligibleForMembership` checks
`eligible_user_types.includes(user_type)` — so the faculty accounts are
`faculty` and need a `ubc.ca` address matching their own `faculty_email`, and
the non-UBC ones are `nonUbc`. Each type owns a mutually exclusive field set,
mirroring `completeMembershipProfile`; the validator rejects a fixture that
mixes them.

Three of the twelve are **deep** fixtures (`fullEventHistory: true`) carrying
purchased tickets across every phase, applications, and check-ins:
`admin-explorer@example.com`, `no-membership@example.com`, and
`student-innovator@example.com`. The other nine hold a membership purchase at
most — giving each of them a full timeline would be a lot of fixture data to
keep correct for very little.

`data/crowd.ts` — the **crowd**: 42 profile-only accounts (no Auth user, so
nobody can sign in as one), the shape of a member imported before they ever
signed in. They exist for volume: the admin users table, the review list,
attendee lists and CSV export. Everything is written out or derived from a list
index, so every run builds the same people. Addresses are on
`crowd.uxhub.test`, or `crowd.ubc.ca` for faculty (whose `faculty_email` must be
a ubc.ca address matching their own); those domains are how the prune
recognises the crowd, so never sign up with one. They cover:

- Every user type, every tier, and no membership; two lapsed members
  (`membership_expires_at` in the past, for the renewal flow), one of them with
  a renewal pending (`membership_pre_ordered_type_id` and a `pending` purchase,
  "Pending — payment processing"); a `canceled` and a `failed` membership
  purchase; five students verified by the manager.
- Applications in every state admins see. `uxathon-upcoming`: 8 submitted, 4
  waitlisted, 3 accepted with a live offer (holding seats), 2 offer expired,
  4 registered, 3 rejected, plus `student-innovator`'s draft, which admins never
  see. Seven carry a portfolio PDF, uploaded to `application-files` at the path
  the app uses (`<user>/<application>/<question>/<file>`).
  `design-sprint-upcoming` has a smaller queue; `uxathon-past` has attendees
  with check-ins and rejections. Every application past draft has a fixed
  `submitted_at`, so the review list's order doesn't change between runs.
- Tickets, with completed purchases for paid ones: 22 on `thinkbox-office-tour`,
  20 on `figma-basics-workshop`, 16 on `design-jam-today`, 20 on last year's
  `get-to-know-ux-hub` with door check-ins.

All of it goes through the same batched upserts as the login fixtures, so a run
takes a few seconds. `validateUserFixtures` also holds every event to its
capacity (tickets plus open offers, as `event_seat_counts_unfiltered` counts
them), since nothing in the database checks it on a direct insert.

Renaming a fixture leaves its old account behind, holding the idempotency keys
the new one needs. `RETIRED_FIXTURE_EMAILS` lists those addresses and the seed
deletes them before writing. Only ever put an address there that an earlier
version of the seed created.

`data/images/` — square PNGs uploaded to `event-images` under `seed/covers/`.
Fixtures reference them by file name through `imageKey`; `image_url` is filled
in at run time from the target's own host.

`data/membership-types.ts` — the four tiers. Names and descriptions mirror
production. Local only: production's tiers are live and admins edit them in
Club Settings, so `--target=prod` skips them rather than revert those edits.
Copy a production edit here by hand to keep local in step.

## Layout

| File                     | Role                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `index.ts`               | CLI, orchestration, and the prune pass                       |
| `lib/targets.ts`         | local vs prod resolution and per-target policy               |
| `lib/reconcile.ts`       | upsert-by-slug and child reconciliation primitives           |
| `lib/reconcile-users.ts` | accounts, crowd, purchases, tickets, applications, files, and their prune |
| `lib/review-notes.ts`    | reviewer notes and their former-reviewer author: checks, reconcile, prune |
| `lib/pdf.ts`             | the one-page PDF behind seeded file answers                   |
| `lib/prune.ts`           | pure delete planning — the ownership rules live here         |
| `lib/images.ts`          | cover upload, URL building, and stale-image cleanup          |
| `lib/user-fixtures.ts`   | fixture validation, run before anything is written           |
| `lib/relative-dates.ts`  | date helpers that keep the timeline relative to the run      |

Deletions are planned in `lib/prune.ts` before they happen, so `--dry-run` and a
real run cannot disagree about what would go.

## Adding a fixture

1. Edit the file in `data/`.
2. Add the slug to `EVENT_PHASES` if it is an event, and give it an `imageKey`.
3. `pnpm test scripts/seed` — the fixtures are validated and the timeline is
   held to its intended shape.
4. `pnpm seed --dry-run`, then `pnpm seed`.

Changing a slug is safe locally: prune removes the row under the old slug. On
prod it leaves the old row behind, to be deleted by hand.

## Production payment smoke test

The payment smoke-test tier is intentionally separate from the normal seed. It
creates one public `Payment Smoke Test` membership for `$1.23 CAD` and never
creates users or fabricated purchases. Apply all migrations before using it so
the `membership_types.active` column exists.

Use a dedicated basic-role account created through the normal production sign-up
flow. The account must have a complete membership profile and no active or
pending membership.

```bash
pnpm payment-smoke seed --target=prod --dry-run
pnpm payment-smoke seed --target=prod

# Complete the real checkout in production, then inspect application state.
pnpm payment-smoke status --target=prod

pnpm payment-smoke unseed --target=prod --dry-run
pnpm payment-smoke unseed --target=prod
```

Every command requires an explicit target and uses the same target-specific
environment variables and URL checks as `pnpm seed`. `seed` is idempotent and
refuses to overwrite a membership whose fixed name or slug belongs to another
row.

`status` reports purchase, fulfillment, webhook, and confirmation-email state.
It cannot confirm settlement; verify the payment's gross amount, fee, net amount,
and transfer in Square Dashboard, then confirm the transfer in the linked bank
account.

`unseed` first makes the tier inactive so it cannot be offered, assigned, or
purchased. It deletes an unreferenced tier. After a real purchase, it retains the
inactive tier because purchases and membership profiles deliberately keep their
financial references. It never removes purchases, webhook events, users, or
membership assignments.
