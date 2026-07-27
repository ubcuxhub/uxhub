# Phase 0 — Verify

**Goal:** Confirm each finding against a real instance before changing anything.
**Changes shipped:** None.

The findings in [README.md](./README.md) were derived by reading migrations and
source. That is enough to plan against, but not enough to act on — a misread
policy could send us hardening something that was already sound, or worse,
"fixing" a policy in a way that breaks a working page for no security gain.

Work through the checklist, then record the outcome in the results table below.

## Checklist

- [x] **F1 — anon read.** With a plain anon key and no session:
      `select email, phone, student_number from user_info` — confirm rows come
      back.
- [x] **F3 — privileged-column writes.** As a non-admin user, confirm the
      existing trigger rejects
      `update user_info set role_access='admin' where email = <self>`, then
      confirm an unguarded privileged field such as `membership_expires_at`
      remains writable. Locally verified: role self-promotion was rejected;
      `membership_expires_at` self-update succeeded.
- [x] **F2 — account takeover.** Confirm end-to-end using two throwaway
      accounts. **Local instance only** (`supabase start`) — never staging or
      production.
- [x] **F4 — cross-user registration write.** Verify the installed
      `event_registrations` policies permit authenticated reads and updates with
      `USING (true)` / `WITH CHECK (true)`.
- [x] **F5 — cross-user application read.** Verify the installed
      `event_application_responses` select policy permits authenticated reads
      with `USING (true)`.
- [x] **Service-role actor check.** Confirm what `auth.uid()` returns when the
      service-role client writes. Phase 1c's trigger uses `auth.uid() is null` as
      the escape hatch for fulfillment; if that assumption is wrong, the trigger
      either blocks Square fulfillment or lets everyone through. Test before
      writing it.
- [x] **F8 — recursion check.** Drop the `visibility` policy on a scratch
      database and confirm whether the inlined admin subqueries on `user_info`
      raise `infinite recursion detected in policy for relation`. This
      determines whether the `SECURITY DEFINER` helper in Phase 1c is
      load-bearing or merely tidy.

## Dependency inventory

Phase 1c and Phase 3 will break any page that relies on a permissive policy.
Before touching them, list what actually depends on each:

- [x] Which pages read `user_info` rows other than the caller's?
      `/admin/users`, `/admin/events/[event]/review-applications`,
      `/admin/events/[event]/review-applications/[registrationId]`, and
      `/admin/events/[event]/check-in`.
- [x] Which pages read or write `event_registrations` for other users?
      `/admin/events/[event]/review-applications`,
      `/admin/events/[event]/review-applications/[registrationId]`, and
      `/admin/events/[event]/check-in`; event deletion also deletes all
      registrations from `EventCreateModify`.
- [x] Which client-side code writes columns that Phase 1c's grant will exclude?
      `/admin/users` edits `role_access`, `membership_type_id`, and
      `student_number`; `MembershipWizard` and `ProfileSettings` write
      `user_type` and `student_number`.

This inventory determines Phase 2's ordering, so it is not optional.

## Results

Fill in as each item is checked. A "Not reproducible" result is a real outcome —
it means the plan for that finding should be dropped, not quietly worked around.

| Finding | Verified? | Notes |
|---|---|---|
| F1 | Yes | Anon role returned the existing `user_info` row. |
| F2 | Yes | Local unauthenticated request rebound an admin profile to the attacker's auth ID while preserving the admin role; fixtures were deleted. |
| F3 | Partial | Existing trigger blocks `role_access`; membership fields remain self-writable. Design revised to match. |
| F4 | Yes | Installed select/update policies are unconditional for `authenticated`. |
| F5 | Yes | Installed select policy is unconditional for `authenticated`. |
| F8 | Partial | Inverted caller/row check confirmed; removing `visibility` did not cause recursion. |
