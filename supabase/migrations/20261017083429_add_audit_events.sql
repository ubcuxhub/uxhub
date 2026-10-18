-- One table behind two views: the admin change log (written by the trigger
-- below) and the user activity feed (written by explicit calls in app code).
-- `source` is what separates them.

create type public.audit_event_source as enum ('admin_change', 'user_activity');

create table public.audit_events (
  id            uuid primary key default gen_random_uuid(),
  source        public.audit_event_source not null,
  -- Dot-path naming, like the structured log events: 'user_info.updated',
  -- 'membership.purchased', 'account.deleted'.
  action        text not null check (action <> ''),
  -- The profile row, not the auth user, so an entry survives account deletion:
  -- delete_account anonymizes user_info and keeps the row, which is what makes
  -- a deleted member render as "Deleted member" rather than vanishing.
  actor_id      uuid references public.user_info(id) on delete set null,
  -- What the entry is about. The History tab filters on this pair.
  subject_table text,
  subject_id    uuid,
  -- Admin changes only: {"column": {"from": ..., "to": ...}}.
  changes       jsonb,
  -- Anything a caller wants to show without a join, e.g. an event name.
  context       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint audit_events_subject_pair check (
    (subject_table is null) = (subject_id is null)
  )
);

-- Both feeds read newest first, filtered by source.
create index idx_audit_events_source_created_at
  on public.audit_events (source, created_at desc);

-- The History tab reads one row's entries.
create index idx_audit_events_subject
  on public.audit_events (subject_table, subject_id, created_at desc)
  where subject_id is not null;

alter table public.audit_events enable row level security;

-- Admins read; nobody writes through PostgREST. Entries come from the trigger
-- or from server-side code holding the service-role key, so there are
-- deliberately no insert, update, or delete policies: an audit log that a
-- client can edit is not one.
create policy "admins can read audit events"
  on public.audit_events
  for select
  using (public.is_admin());

grant select on table public.audit_events to authenticated;
grant all on table public.audit_events to service_role;

-- Columns that change on every write and say nothing about intent.
create function public.audit_ignored_columns() returns text[]
language sql immutable set search_path = public as $$
  select array['updated_at', 'created_at']::text[];
$$;
revoke all on function public.audit_ignored_columns() from public, anon, authenticated;

/*
 * Records an admin edit as a column-level diff.
 *
 * The actor is read from `app.audit_actor_id` first and `auth.uid()` second.
 * Admin edits are written with the service-role key, which has no `auth.uid()`,
 * so a caller that wants the actor recorded has to set that setting inside its
 * transaction. An entry with a null actor is still worth keeping — it says the
 * row changed — so a missing actor never blocks the write.
 */
create function public.log_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor   uuid;
  v_old     jsonb := to_jsonb(old);
  v_new     jsonb := to_jsonb(new);
  v_changes jsonb := '{}'::jsonb;
  v_key     text;
begin
  -- delete_account's anonymization rewrites most of the profile at once. That
  -- is a user activity, logged explicitly by the app, not an admin edit, and
  -- recording the diff would copy the PII the deletion just removed.
  --
  -- Tested through the jsonb rather than `new.deleted_at`: this function is on
  -- three tables and plpgsql resolves a record field even inside a guard that
  -- is false, so naming the column directly fails on the tables without it.
  if v_new ? 'deleted_at'
     and v_new ->> 'deleted_at' is not null
     and v_old ->> 'deleted_at' is null then
    return new;
  end if;

  for v_key in select jsonb_object_keys(v_new) loop
    if not (v_key = any (public.audit_ignored_columns()))
       and v_old -> v_key is distinct from v_new -> v_key then
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
      );
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return new;
  end if;

  v_actor := nullif(current_setting('app.audit_actor_id', true), '')::uuid;
  if v_actor is null then
    select id into v_actor from public.user_info where auth_user_id = auth.uid();
  end if;

  insert into public.audit_events (
    source, action, actor_id, subject_table, subject_id, changes
  )
  values (
    'admin_change',
    tg_table_name || '.updated',
    v_actor,
    tg_table_name,
    (v_new ->> 'id')::uuid,
    v_changes
  );

  return new;
end;
$$;
revoke all on function public.log_admin_change() from public, anon, authenticated;

create trigger log_user_info_changes
  after update on public.user_info
  for each row execute function public.log_admin_change();

create trigger log_event_changes
  after update on public.events
  for each row execute function public.log_admin_change();

create trigger log_membership_type_changes
  after update on public.membership_types
  for each row execute function public.log_admin_change();

/*
 * Drops the recorded values for a member who has deleted their account.
 *
 * delete_account exists to remove someone's personal data; a change log holding
 * their old email and phone forever would quietly undo that. The entries stay,
 * so the history still reads as "an admin edited this row", and the actor still
 * resolves to the anonymized profile.
 */
create function public.scrub_audit_events_for_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.audit_events
    set changes = case when changes is null then null else '{"redacted": true}'::jsonb end,
        context = '{"redacted": true}'::jsonb
    where (subject_table = 'user_info' and subject_id = new.id)
       or actor_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_audit_events_for_deleted_user() from public, anon, authenticated;

create trigger scrub_audit_events_on_account_deletion
  after update on public.user_info
  for each row execute function public.scrub_audit_events_for_deleted_user();
