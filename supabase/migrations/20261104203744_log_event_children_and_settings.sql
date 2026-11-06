-- Widens the admin change log past users, events, and membership tiers.
--
-- An event is edited through its children as much as through its own row --
-- the agenda, who is speaking, who is sponsoring, who has been accepted --
-- and none of that left a trace. Those entries are recorded against the
-- event, so the History tab stays one query rather than a union.
--
-- Club Settings is logged too, with no subject: it is a single row keyed by a
-- boolean, and `action` already says which setting changed.

-- `log_admin_change` assumed every table it covers has a uuid `id`.
-- app_settings keys on a boolean, so the subject is now derived defensively
-- and left null when there is no uuid to point at.
create or replace function public.log_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor      uuid;
  v_old        jsonb := to_jsonb(old);
  v_new        jsonb := to_jsonb(new);
  v_changes    jsonb := '{}'::jsonb;
  v_key        text;
  v_subject_id uuid;
begin
  -- delete_account's anonymization rewrites most of the profile at once. That
  -- is a user activity, logged explicitly by the app, not an admin edit, and
  -- recording the diff would copy the PII the deletion just removed.
  --
  -- Tested through the jsonb rather than `new.deleted_at`: this function is on
  -- several tables and plpgsql resolves a record field even inside a guard
  -- that is false, so naming the column directly fails on tables without it.
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

  -- No actor, or one who is not an admin, means this is not an admin edit.
  if v_actor is null or not exists (
    select 1 from public.user_info
    where id = v_actor
      and role_access in (
        'admin'::public.role_access_enum,
        'manager'::public.role_access_enum
      )
  ) then
    return new;
  end if;

  begin
    v_subject_id := (v_new ->> 'id')::uuid;
  exception when others then
    v_subject_id := null;
  end;

  insert into public.audit_events (
    source, action, actor_id, subject_table, subject_id, changes
  )
  values (
    'admin_change',
    tg_table_name || '.updated',
    v_actor,
    case when v_subject_id is null then null else tg_table_name end,
    v_subject_id,
    v_changes
  );

  return new;
end;
$$;

/*
 * Records a change to one of an event's child rows against the event.
 *
 * Covers inserts and deletes as well as updates, because adding a speaker or
 * removing an agenda item is the edit -- there is no diff to see on the event
 * row itself. Inserts read as `{"column": {"from": null, "to": …}}` and
 * deletes as the reverse, so the History tab renders all three the same way.
 *
 * The event is found through `event_id`, or through the parent day for agenda
 * items, which only reference their day.
 */
create function public.log_event_child_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid;
  v_row      jsonb := to_jsonb(coalesce(new, old));
  v_old      jsonb := case when old is null then '{}'::jsonb else to_jsonb(old) end;
  v_new      jsonb := case when new is null then '{}'::jsonb else to_jsonb(new) end;
  v_changes  jsonb := '{}'::jsonb;
  v_key      text;
  v_event_id uuid;
  v_verb     text := case tg_op
                       when 'INSERT' then 'created'
                       when 'DELETE' then 'deleted'
                       else 'updated'
                     end;
begin
  v_actor := nullif(current_setting('app.audit_actor_id', true), '')::uuid;
  if v_actor is null then
    select id into v_actor from public.user_info where auth_user_id = auth.uid();
  end if;

  -- A student submitting an application, or the seed script writing an
  -- agenda, is not an admin edit.
  if v_actor is null or not exists (
    select 1 from public.user_info
    where id = v_actor
      and role_access in (
        'admin'::public.role_access_enum,
        'manager'::public.role_access_enum
      )
  ) then
    return coalesce(new, old);
  end if;

  if v_row ? 'event_id' then
    v_event_id := (v_row ->> 'event_id')::uuid;
  elsif v_row ? 'event_agenda_day_id' then
    select event_id into v_event_id from public.event_agenda_days
    where id = (v_row ->> 'event_agenda_day_id')::uuid;
  end if;

  -- The parent is already gone on a cascading delete, so there is nothing to
  -- attach the entry to and the event's own deletion is the record.
  if v_event_id is null then
    return coalesce(new, old);
  end if;

  for v_key in select jsonb_object_keys(v_row) loop
    if not (v_key = any (public.audit_ignored_columns()))
       and v_old -> v_key is distinct from v_new -> v_key then
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
      );
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return coalesce(new, old);
  end if;

  insert into public.audit_events (
    source, action, actor_id, subject_table, subject_id, changes
  )
  values (
    'admin_change',
    tg_table_name || '.' || v_verb,
    v_actor,
    'events',
    v_event_id,
    v_changes
  );

  return coalesce(new, old);
end;
$$;
revoke all on function public.log_event_child_change() from public, anon, authenticated;

create trigger log_event_agenda_day_changes
  after insert or update or delete on public.event_agenda_days
  for each row execute function public.log_event_child_change();

create trigger log_event_agenda_item_changes
  after insert or update or delete on public.event_agenda_items
  for each row execute function public.log_event_child_change();

create trigger log_event_mentor_changes
  after insert or update or delete on public.event_mentors
  for each row execute function public.log_event_child_change();

create trigger log_event_sponsor_changes
  after insert or update or delete on public.event_sponsors
  for each row execute function public.log_event_child_change();

-- Updates only: an application appearing is the student applying, and its
-- removal follows the event. A status change is the admin decision.
create trigger log_event_application_changes
  after update on public.event_applications
  for each row execute function public.log_event_child_change();

create trigger log_app_settings_changes
  after update on public.app_settings
  for each row execute function public.log_admin_change();
