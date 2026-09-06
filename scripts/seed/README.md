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

The target is always explicit, and each one checks its URL really is the
environment it claims to be — a mispaste fails instead of hitting the wrong
project.

|                        | `local` (default)             | `prod`                          |
| ---------------------- | ----------------------------- | ------------------------------- |
| URL                    | `NEXT_PUBLIC_SUPABASE_URL`    | `SEED_PROD_SUPABASE_URL`        |
| Key                    | `SUPABASE_SECRET_KEY`         | `SEED_PROD_SUPABASE_SECRET_KEY` |
| Deletes stale rows     | yes, unless `--no-prune`      | **never**                       |
| Login fixtures         | yes                           | **never**                       |
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

Prod also expects its migrations to be applied already (`npx supabase db push`)
— the run fails with that instruction if the storage bucket is missing.

## What gets deleted (local only)

`pnpm seed` reconciles *to* its data, so it removes seed-owned rows the data no
longer describes. That is what makes event checkout re-testable: buy a ticket as
a fixture account, re-run the seed, and the purchase is gone.

Deletion is scoped by ownership, not by table:

| Prunable                                                  | Never touched                                       |
| --------------------------------------------------------- | --------------------------------------------------- |
| Events and membership tiers matched by slug                | Auth users and profiles created by hand              |
| Mentors, sponsors, check-in sessions, application questions| Purchases and registrations owned by any other account |
| Purchases and registrations owned by the fixture accounts  | Covers uploaded through the admin UI (`covers/`)     |
| Cover images under the `seed/covers/` storage prefix       |                                                      |

An extra event survives if a non-fixture purchase points at it —
`purchases.event_id` is `on delete restrict`, so somebody else's ticket keeps
the event alive and the run says which. Same for mentors, sponsors, and tiers,
which are `restrict` from their link tables.

## Fixtures

`data/events.ts` — 15 events. `EVENT_PHASES` at the top is the index of what
each one is for. The biggest group is **purchasable**: upcoming, active,
registration open, and left unbought by every fixture account so event checkout
can be run repeatedly. A test fails if a fixture purchase ever lands on one.
The rest cover archived history, a closed registration window, a not-yet-open
one, and a draft.

`data/users.ts` — ten local accounts. **Password is `123456` for all of them.**
They cover every membership state crossed with both roles:

| Membership | Non-admin                       | Admin                             |
| ---------- | ------------------------------- | --------------------------------- |
| Explorer   | `student-explorer@example.com`  | `admin-explorer@example.com`      |
| Innovator  | `student-innovator@example.com` | `admin-innovator@example.com`     |
| Faculty    | `faculty-member@ubc.ca`         | `admin-faculty@ubc.ca`            |
| Non-UBC    | `non-ubc@example.com`           | `admin-non-ubc@example.com`       |
| None       | `no-membership@example.com`     | `admin-no-membership@example.com` |

The tier decides `user_type` — `isEligibleForMembership` checks
`eligible_user_types.includes(user_type)` — so the faculty accounts are
`faculty` and need a `ubc.ca` address matching their own `faculty_email`, and
the non-UBC ones are `nonUbc`. Each type owns a mutually exclusive field set,
mirroring `completeMembershipProfile`; the validator rejects a fixture that
mixes them.

Three of the ten are **deep** fixtures (`fullEventHistory: true`) carrying
purchased registrations across every phase, applications, and check-ins:
`admin-explorer@example.com`, `no-membership@example.com`, and
`student-innovator@example.com`. The other seven hold a membership purchase at
most — giving each of them a full timeline would be a lot of fixture data to
keep correct for very little.

Renaming a fixture leaves its old account behind, holding the idempotency keys
the new one needs. `RETIRED_FIXTURE_EMAILS` lists those addresses and the seed
deletes them before writing. Only ever put an address there that an earlier
version of the seed created.

`data/images/` — square PNGs uploaded to `event-images` under `seed/covers/`.
Fixtures reference them by file name through `imageKey`; `image_url` is filled
in at run time from the target's own host.

`data/membership-types.ts` — the four tiers. Names mirror production.

## Layout

| File                     | Role                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `index.ts`               | CLI, orchestration, and the prune pass                       |
| `lib/targets.ts`         | local vs prod resolution and per-target policy               |
| `lib/reconcile.ts`       | upsert-by-slug and child reconciliation primitives           |
| `lib/reconcile-users.ts` | accounts, purchases, registrations, and their prune          |
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
