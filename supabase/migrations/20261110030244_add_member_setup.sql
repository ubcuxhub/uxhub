-- Member setup: three skippable steps after a new member's first sign-in
-- (dietary needs, a photo, interests). See docs/design/auth-onboarding-review.md
-- §4 and src/features/setup.
--
-- Backward compatible with the code already in production: every column is
-- additive with a default, `dietary_restrictions` stays (and is mirrored, see
-- below), and nothing the old code writes is rejected.

-- ── Setup progress ─────────────────────────────────────────────────────────
-- One column is both the gate and the resume point: the step to show next, or
-- `done` once the member finished or skipped the last step. Every row that
-- exists now is an existing member, so the column is added with `done` (the
-- backfill) and only then defaults to the first step for new rows.
alter table public.user_info
  add column setup_step text not null default 'done'
    constraint user_info_setup_step_valid
      check (setup_step in ('dietary', 'photo', 'interests', 'done'));
alter table public.user_info alter column setup_step set default 'dietary';

-- ── Structured dietary needs ───────────────────────────────────────────────
-- Chip ids (src/features/setup/lib/options.ts) plus free "other allergies"
-- entries. All empty means "no dietary needs" once setup is past that step.
alter table public.user_info
  add column diets text[] not null default '{}',
  add column allergies text[] not null default '{}',
  add column other_allergies text[] not null default '{}';

-- Every value from `allowed`, none twice, one dimension.
create function public.valid_option_list(choices text[], allowed text[]) returns boolean
language sql immutable set search_path = public as $$
  select (cardinality(choices) = 0 or array_ndims(choices) = 1)
    and choices <@ allowed
    and cardinality(choices) = (select count(distinct c) from unnest(choices) c);
$$;

-- Trimmed, non-empty, at most 200 characters, unique ignoring case, at most 20.
create function public.valid_other_allergies(entries text[]) returns boolean
language sql immutable set search_path = public as $$
  select cardinality(entries) <= 20
    and (cardinality(entries) = 0 or array_ndims(entries) = 1)
    and not exists (
      select 1 from unnest(entries) e
      where e is null or e = '' or e <> btrim(e) or char_length(e) > 200
    )
    and cardinality(entries) = (select count(distinct lower(e)) from unnest(entries) e);
$$;

alter table public.user_info
  add constraint user_info_valid_diets check (public.valid_option_list(
    diets, array['vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher'])),
  add constraint user_info_valid_allergies check (public.valid_option_list(
    allergies, array['peanuts', 'tree-nuts', 'dairy', 'eggs', 'gluten', 'soy', 'fish', 'shellfish'])),
  add constraint user_info_valid_other_allergies check (public.valid_other_allergies(other_allergies));

-- ── Avatar preset ──────────────────────────────────────────────────────────
-- A brand shape key, rendered by the app; never an image. An uploaded
-- `profile_photo_path` takes precedence when both are set.
alter table public.user_info
  add column avatar_preset text
    constraint user_info_avatar_preset_valid
      check (avatar_preset in ('pointer', 'splash', 'flower', 'triangle', 'sparkle', 'starburst'));

-- ── Keep the legacy free text ──────────────────────────────────────────────
-- Existing `dietary_restrictions` text becomes one "other allergies" entry, so
-- nothing is lost. The legacy column stays for the code in production and for
-- Settings, which still edits it; a later migration drops it (and the trigger
-- below) once nothing reads it. Its own timestamp is not this migration's
-- business, so `updated_at` is left alone.
alter table public.user_info disable trigger update_user_info_updated_at;
update public.user_info
set other_allergies = array[btrim(left(btrim(dietary_restrictions), 200))]
where nullif(btrim(dietary_restrictions), '') is not null;
alter table public.user_info enable trigger update_user_info_updated_at;

-- Mirrors whichever of the two a write changes into the other, so old code,
-- Settings and setup all see the same answer while both columns exist.
create function public.sync_legacy_dietary_restrictions() returns trigger
language plpgsql set search_path = public as $$
declare
  legacy_changed boolean;
  other_changed boolean;
begin
  if tg_op = 'INSERT' then
    legacy_changed := new.dietary_restrictions is not null and new.other_allergies = '{}';
    other_changed := new.other_allergies <> '{}' and new.dietary_restrictions is null;
  else
    legacy_changed := new.dietary_restrictions is distinct from old.dietary_restrictions
      and new.other_allergies is not distinct from old.other_allergies;
    other_changed := new.other_allergies is distinct from old.other_allergies
      and new.dietary_restrictions is not distinct from old.dietary_restrictions;
  end if;

  if legacy_changed then
    new.other_allergies := case
      when nullif(btrim(new.dietary_restrictions), '') is null then '{}'::text[]
      else array[btrim(left(btrim(new.dietary_restrictions), 200))]
    end;
  elsif other_changed then
    new.dietary_restrictions := nullif(array_to_string(new.other_allergies, ', '), '');
  end if;

  return new;
end;
$$;
revoke all on function public.sync_legacy_dietary_restrictions() from public, anon, authenticated;
create trigger sync_legacy_dietary_restrictions before insert or update on public.user_info
for each row execute function public.sync_legacy_dietary_restrictions();

-- ── Account deletion ───────────────────────────────────────────────────────
-- Also runs during delete_account's existing anonymization update. It sorts
-- before the mirror above, which then sees both columns change and does nothing.
create function public.scrub_user_setup() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null then
    new.diets := '{}';
    new.allergies := '{}';
    new.other_allergies := '{}';
    new.avatar_preset := null;
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_user_setup() from public, anon, authenticated;
create trigger scrub_user_setup before update on public.user_info
for each row execute function public.scrub_user_setup();

-- ── Member writes ──────────────────────────────────────────────────────────
-- Members update their own row ("user_info: update own row") and the checks
-- above validate every value, as with `dietary_restrictions`. Uploaded photos
-- (storage) and interests (a column shared with managers' free tags, validated
-- against the TypeScript taxonomy) stay server-only: the setup actions write
-- them with the service role for the signed-in member's own row.
grant update (setup_step, diets, allergies, other_allergies, avatar_preset)
  on public.user_info
  to authenticated;
