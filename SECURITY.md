# Security

UX Hub holds student personal information and processes real payments. This
document explains how the app protects both, and what you need to know before
you change anything that touches member data.

## Reporting a vulnerability

**Please do not open a public issue for a security bug.**

- Preferred: [GitHub private vulnerability reporting](https://github.com/ubcuxhub/uxhub/security/advisories/new)
- Or email **ubcuxhub@gmail.com** with "SECURITY" in the subject line

Tell us what you found, how to reproduce it, and what an attacker could reach.
We aim to acknowledge within 72 hours. Please give us a chance to ship a fix
before disclosing publicly. We will credit you unless you'd rather stay
anonymous.

There is no bug bounty — we're a student club — but we take reports seriously
and we'll say thank you properly.

## The one-paragraph version

Authorization is enforced by **the database**, not by the UI. Every table has
Row Level Security turned on, so a member's browser session can only read rows
Postgres decides it may read. Server-side guards and hidden UI are convenience
and clarity — they are not the security boundary. This means a mistake in a
React component cannot leak another student's data.

## Layers, and what each one is actually for

| Layer | File | What it does | Is it a security boundary? |
| --- | --- | --- | --- |
| Proxy | [`src/proxy.ts`](src/proxy.ts) | Refreshes the Supabase session cookie | **No.** It deliberately does no authorization. |
| Route guards | [`src/lib/auth/guards.ts`](src/lib/auth/guards.ts) | `requireAuth`, `requireAdmin`, `requireManager` — redirect unauthorized users | Partly. Controls *page access*, not *data access*. |
| Sidebar / UI | [`src/components/shared/AppSidebar.tsx`](src/components/shared/AppSidebar.tsx) | Hides links a user can't use | **No.** Cosmetic only. |
| Row Level Security | [`supabase/migrations/`](supabase/migrations) | Decides which rows each role may read and write | **Yes. This is the real one.** |
| Column grants + triggers | `user_info` | Blocks privilege escalation | **Yes.** |

If you remember one thing: **hiding a button is not security.** Assume every
authenticated user can call every query your code can call, with any arguments.
RLS is what stops them.

## Roles

Three levels, defined in [`src/lib/auth/roles.ts`](src/lib/auth/roles.ts) and
mirrored by the `is_admin()` / `is_manager()` functions in Postgres:

| Role | Can do |
| --- | --- |
| `user` | Read and edit their own profile, their own registrations, their own purchases |
| `admin` | Everything above, plus manage events, view the member directory, run check-in |
| `manager` | Everything above, plus change other people's roles and edit club settings |

`is_admin()` returns true for managers too — managers inherit operational admin
access, and manager-only powers use the narrower `is_manager()`.

## Row Level Security

RLS is enabled on **all 15 application tables**. The general shape:

- **Own-row access.** Members read their own `user_info`, `event_registrations`,
  `event_application_responses`, and `purchases` — matched on
  `auth.uid()` or `current_user_info_id()`, never on a value the client sends.
- **Admin access** goes through `is_admin()`, evaluated inside Postgres against
  the caller's real session. A client cannot fake it.
- **Public reads are narrow.** Anonymous visitors can read events only where
  `status = 'active'`, and membership tiers. Draft events are invisible to
  everyone except admins and managers.

The `is_admin()` and `current_user_info_id()` helpers are `security definer`
with `search_path` pinned, and `execute` is revoked from `anon`.

## Privilege escalation is blocked in two places

A member updating their own profile must not be able to make themselves an
admin, or hand themselves a membership they didn't pay for. Two mechanisms stop
this:

1. **Column-level grants.** `UPDATE` on `user_info` is revoked from `anon` and
   `authenticated`, then granted back on a specific list of self-service
   columns only.
2. **A `BEFORE UPDATE` trigger** (`guard_user_info_privileged_columns`) raises
   an exception if a non-admin changes `role_access`, `membership_type_id`,
   `membership_expires_at`, `auth_user_id`, `email`, `user_type`,
   `student_number`, or `square_customer_id`.

Role changes must go through `set_user_role()`, which requires manager rights,
serializes concurrent changes, and **refuses to demote the last remaining
manager** — so the club cannot accidentally lock itself out.

## The service-role key bypasses everything

[`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts) holds a client that
ignores RLS completely. Rules:

- It is marked `server-only`, so importing it into a client component is a
  **build error**, not a runtime surprise.
- Use it only where RLS genuinely cannot work: webhooks, profile repair, uploads.
- When you use it, you are now the authorization check. Write the check
  explicitly and comment why RLS wasn't an option.
- Prefer the typed anon-key helpers in
  [`src/lib/supabase-helpers/`](src/lib/supabase-helpers) for everything else.

## Payments

Card details never touch our servers. Square's Web SDK tokenizes the card in the
browser; we only ever see a token.

The Square webhook ([`src/app/api/square/webhook/route.ts`](src/app/api/square/webhook/route.ts)):

- **Verifies the HMAC-SHA256 signature** on every delivery and rejects
  unsigned or mis-signed requests with a 403. Multiple endpoints are supported
  because Square signs each subscription with its own key over its own URL.
- **Is idempotent.** Webhooks retry; purchases carry an idempotency key and
  deliveries are recorded in `square_webhook_events`, so a replay cannot
  double-charge or double-grant a membership.

Checkout requires **both** `card.tokenize()` and `payments.verifyBuyer()` —
the second runs the issuer's Strong Customer Authentication challenge. Dropping
it causes declines on cards whose bank requires verification.

## Secrets

These are **server-only** and must never reach a client component or a
`NEXT_PUBLIC_` variable:

- `SUPABASE_SECRET_KEY`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

Local values live in `.env.local`, which is git-ignored. If you think a secret
has been committed or shared, rotate it first and ask questions after — rotation
is cheap.

Anything prefixed `NEXT_PUBLIC_` is shipped to the browser by design. The
Supabase anon key is one of these and that is fine: it is only as powerful as
the RLS policies allow.

## Personal data and account deletion

Members can delete their own account. `delete_account()` destroys the auth login
permanently and strips every personal field from the profile — name, email,
phone, pronouns, student number, faculty — while keeping the now-anonymous row
so purchase records and attendance headcounts stay intact for club accounting.

The email is rewritten rather than blanked, deliberately: a deleted row that kept
its address would be silently re-adopted by the next sign-up from that person,
along with all of their history.

## How this is tested

[`supabase/tests/rls.sql`](supabase/tests/rls.sql) is a 600-line suite that
asserts the policies actually hold — that one member cannot read another's
profile, registrations, or purchases, and that a non-admin cannot escalate
their role.

```bash
pnpm test:rls
```

It runs in a transaction it rolls back, so it is safe and repeatable against a
seeded database. **CI runs it on every push and pull request** against a
throwaway database with every migration applied.

## Checklist before you merge

- [ ] New table? RLS enabled, with policies, in the same migration.
- [ ] New policy? Add a case to `supabase/tests/rls.sql` proving it denies as
      well as allows.
- [ ] Used `supabaseAdmin`? Justified in a comment, with an explicit
      authorization check.
- [ ] New secret? Server-only, and not prefixed `NEXT_PUBLIC_`.
- [ ] Relying on hidden UI for access control? Move it into a policy.

## Known limitations

Being honest about these is better than pretending:

- **Sessions are checked against Supabase on each request today.** When the
  planned move to local JWT verification lands, a session revoked out-of-band
  will remain valid until its access token expires. The blast radius is bounded
  because every mutation is still re-authorized by RLS.
- **No rate limiting** on auth endpoints beyond what Supabase provides by
  default.
- **No automated dependency scanning** yet. Dependabot is the obvious next step.
