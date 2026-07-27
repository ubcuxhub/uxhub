# Security Hardening

**Status:** Implemented locally; staging verification and operational follow-ups pending
**Created:** 2026-07-26
**Scope:** Authorization boundaries — RLS policies, privileged API routes, and eligibility enforcement

| | |
|---|---|
| Phasing and rollout | [phases.md](./phases.md) |
| Phase 0 — Verify | [phase-0.md](./phase-0.md) |
| Phase 1 — Stop the bleeding | [phase-1.md](./phase-1.md) |
| Phase 2 — Server-side privileged access | [phase-2.md](./phase-2.md) |
| Phase 3 — Scope remaining tables | [phase-3.md](./phase-3.md) |

---

## Motivation

There is a gap between what the UI implies about authorization and what the
database enforces.

Route guards (`requireAuth`, `requireAdmin`) protect *pages*. But nearly every
page fetches its data from the browser using the public anon key, so the only
control that actually applies to the data is Row Level Security. Several RLS
policies are written as `USING (true)`, and one privileged API route accepts an
unauthenticated caller's claim about who they are.

The practical consequence: `requireAdmin()` on `/admin/users` gates the page
shell, while the user directory behind it is readable by anyone with the anon key
— which ships in the client bundle by design.

> **These findings were derived by reading the migrations and application source,
> not by executing exploits against a live database.** [Phase 0](./phase-0.md)
> confirms each one against a real instance before anything changes, so we can
> tell a genuine hole from a misread of the policy set.

---

## Findings

| # | Issue | Location | Severity | Fixed in |
|---|---|---|---|---|
| F1 | `user_info` readable by `anon` — every user's name, email, phone, student number | `20260111032511:780` | **Critical** | [1c](./phase-1.md#1c--lock-down-user_info-f1-f3-f8) |
| F2 | Unauthenticated account takeover via `/api/link-auth-user` | `src/app/api/link-auth-user/route.ts` | **Critical** | [1a](./phase-1.md#1a--delete-apilink-auth-user-f2) |
| F3 | Self-update policy is row-scoped but not column-scoped → membership and eligibility fields are self-writable | `20260111032511:732` | High | [1c](./phase-1.md#1c--lock-down-user_info-f1-f3-f8) |
| F4 | `event_registrations` fully open to any authenticated user | `20260111032511:761–773` | High | [3](./phase-3.md) |
| F5 | `event_application_responses` readable/deletable by any authenticated user | `20260111032511:638–658` | High | [3](./phase-3.md) |
| F6 | Event image upload has no authentication | `src/app/api/upload-event-image/route.ts` | High | [1b](./phase-1.md#1b--authenticate-the-image-upload-f6) |
| F7 | Membership eligibility is self-attested client-side | `MembershipWizard`, `canPurchase` | Medium | [3](./phase-3.md) |
| F8 | `admin_select_all` checks the row's role, not the caller's | `20260111032511:712` | Medium (latent) | [1c](./phase-1.md#1c--lock-down-user_info-f1-f3-f8) |
| F9 | `grant all on purchases to anon` | `20260606120000:181` | Low | [3](./phase-3.md) |
| F10 | `event_application_questions` and `check_in_sessions` readable by every authenticated user | `20260111032511:630,634` | Low | [3](./phase-3.md#low-severity-leftovers-f10) |

### F1 — `user_info` is world-readable

```sql
CREATE POLICY "visibility" ON "public"."user_info"
  FOR SELECT TO "authenticated", "anon" USING (true);
```

The anon key is not a secret — it ships in the client bundle by design. This
policy therefore makes the full user directory readable by anyone who opens
DevTools, including `email`, `phone`, `student_number`, and
`dietary_restrictions`. For a student club handling UBC student numbers, this is
the most serious item on the list.

### F2 — `/api/link-auth-user` is an account-takeover endpoint

The route takes `email` and `authUserId` from the request body. It verifies that
the `authUserId` *exists* in Supabase Auth (`route.ts:33`) but never verifies
that the caller **is** that user — there is no session check. It then calls
`adminUpdateUserInfoByEmail` with the service-role client (`route.ts:59`), which
bypasses RLS entirely.

The attack: sign up normally to obtain your own `authUserId`, then

```
POST /api/link-auth-user
{ "authUserId": "<your-own-id>", "email": "<an-admin's-email>", "name": "x" }
```

This rebinds the admin's `user_info.auth_user_id` to the attacker's auth user.
The attacker logs in as themselves, and `fetchUserInfoByAuthId` resolves to the
admin's row — including `role_access: 'admin'`.

A correct implementation of this flow **already exists** at
`/api/auth/complete-profile`: it reads the session server-side and refuses when
an existing row is linked to a different auth user. The fix is to delete the old
route, not patch it.

### F3 — Self-update protects `role_access`, but not other privileged columns

```sql
CREATE POLICY "allow current user to update its own row" ON "public"."user_info"
  FOR UPDATE TO "authenticated"
  USING  (email = (SELECT auth.email()))
  WITH CHECK (email = (SELECT auth.email()));
```

Correct as far as it goes — a user may only write their own row. But RLS has no
notion of columns, so "their own row" includes `membership_type_id`,
`membership_expires_at`, the identity join key `auth_user_id`, and the
eligibility inputs `user_type` and `student_number`.

The existing `prevent_role_access_change_trigger` separately blocks a non-admin
from changing `role_access`; Phase 0 confirmed that self-promotion raises
`Only admins can change role_access`. It does not protect the other privileged
columns: the same verification confirmed that a plain user can change their own
`membership_expires_at`.

Note also that the policy keys on `email` rather than `auth_user_id`. The
`WITH CHECK` prevents changing `email` away from `auth.email()`, but
`auth_user_id` remains user-editable, so the row can still be rebound away from
the authenticated user.

### F4 / F5 — Open policies on registration and application data

```sql
CREATE POLICY "user can select event registrations" ON event_registrations
  FOR SELECT TO authenticated USING (true);
-- ...and matching insert / update / delete, all USING (true)
```

Any authenticated user can read every registration, flip another applicant's
`status` to `'accepted'`, set `attending = true`, or delete registrations
outright. `event_application_responses` is the same story for the free-text
answers applicants submit.

### F8 — `admin_select_all` is inverted

```sql
CREATE POLICY "admin_select_all" ON user_info
  FOR SELECT TO authenticated USING (role_access = 'admin');
```

This grants a caller access to rows **whose** `role_access` is admin, rather than
granting admin callers access to all rows. It is currently masked by the blanket
`visibility` policy, so it has no observable effect — but it becomes a live bug
the moment F1 is fixed. It must be corrected in the same migration.

---

## Target model

Three rules to converge on, which resolve most of the findings by construction.

**1. Deny by default.**
Every policy names a subject (`auth.uid()`) and a predicate tying the row to that
subject. `USING (true)` is acceptable only for genuinely public data — `events`,
`membership_types`.

**2. Privileged writes happen on the server.**
Anything that changes authorization state — `role_access`, membership fields,
registration `status`, eligibility inputs — is written by a server action or
route handler that re-derives the actor from the session. The browser never sends
a claim about *who* it is, only about *what* it wants.

**3. Role checks go through one function.**
The existing policies inline the same `EXISTS (SELECT 1 FROM user_info WHERE
auth_user_id = auth.uid() AND role_access = 'admin')` subquery in a dozen places,
with two different alias conventions.

Phase 0 confirmed that removing the blanket `visibility` policy does not produce
an infinite-recursion error with the installed policy set. The
`SECURITY DEFINER` helper is still valuable: it replaces the inverted F8 policy
with one canonical caller-role check, deduplicates the policy expressions, and
keeps those checks independent from caller-visible rows.

---

## Out of scope

Tracked separately; noted here so the boundary is explicit.

- **Migrating event images to Supabase Storage.** The `writeFile` into `public/`
  on the running container does not survive a deploy. That is a correctness bug,
  independent of the auth gap [Phase 1b](./phase-1.md#1b--authenticate-the-image-upload-f6)
  closes.
- **The `ensureUserInfo` helper** (`users.ts:104`), which inserts a non-existent
  `membership_type` column and would fail at runtime. It is unreachable behind
  `requireAuth()`. Delete it during Phase 2 cleanup.
- **General client-to-server component migration** for non-admin routes, beyond
  what Phase 2 requires.
- **Rate limiting** on auth endpoints.
