-- Member setup asks "What best describes you?" (UBC student, UBC faculty
-- member, not from UBC) as a new first step, and membership join skips its own
-- copy of the question once it has been answered. See src/features/setup.
--
-- Backward compatible with the code already in production: the new column is
-- nullable and additive, and the step list only grows.

-- ── Whether `user_type` was answered ───────────────────────────────────────
-- `user_type` is NOT NULL with a default (`ubcStudent`), so a row can't say
-- whether anyone chose it. This records when the member last answered the
-- question, in setup or in membership join; null means never asked.
alter table public.user_info add column user_type_confirmed_at timestamptz;

-- Backfill: rows whose type someone evidently chose. Sign-up never writes
-- `user_type`, so a row differs from the default, or holds a student number,
-- only after the join flow's details step, Settings or an admin set it; and a
-- held or pre-ordered membership was bought through the join flow (or granted
-- by an admin for that type). `membership_type_id` is never cleared when a
-- membership lapses, so past members count too. Everyone else (default type,
-- no student number, never a member) is left unanswered, and join asks them
-- as it does today. The real answer time is unknown, so these get the time of
-- the migration. Not this migration's business: `updated_at`.
alter table public.user_info disable trigger update_user_info_updated_at;
update public.user_info
set user_type_confirmed_at = now()
where deleted_at is null
  and (
    membership_type_id is not null
    or membership_pre_ordered_type_id is not null
    or user_type <> 'ubcStudent'
    or student_number is not null
  );
alter table public.user_info enable trigger update_user_info_updated_at;

-- ── The new first setup step ───────────────────────────────────────────────
-- Existing rows keep their step (members who predate setup are `done`); only
-- new sign-ups start at `about`.
alter table public.user_info drop constraint user_info_setup_step_valid;
alter table public.user_info
  add constraint user_info_setup_step_valid
    check (setup_step in ('about', 'dietary', 'photo', 'interests', 'done'));
alter table public.user_info alter column setup_step set default 'about';

-- ── Account deletion ───────────────────────────────────────────────────────
-- The answer goes with the rest of setup (20261110030244).
create or replace function public.scrub_user_setup() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null then
    new.diets := '{}';
    new.allergies := '{}';
    new.other_allergies := '{}';
    new.avatar_preset := null;
    new.user_type_confirmed_at := null;
  end if;
  return new;
end;
$$;

-- ── Member writes ──────────────────────────────────────────────────────────
-- A member confirms the type they already have with their own client. The
-- type itself stays privileged (guard_user_info_privileged_columns): changing
-- it touches membership eligibility, so the setup and membership actions
-- write it with the service role, and only when the member holds no active
-- or pending membership.
grant update (user_type_confirmed_at) on public.user_info to authenticated;
