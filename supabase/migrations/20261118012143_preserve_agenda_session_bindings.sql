-- A mapped session must never become an unmapped legacy session: unlinking it
-- before recording attendance would otherwise bypass the item's guards.
create function public.guard_agenda_binding() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='check_in_sessions' then
    if old.agenda_item_id is not null and (new.agenda_item_id is distinct from old.agenda_item_id or new.event_id is distinct from old.event_id) then
      raise exception 'An agenda session cannot be unlinked or reassigned.' using hint='CHECK_IN_SESSIONS_CONFLICT';
    end if;
    if new.agenda_item_id is not null and not exists(select 1 from public.event_agenda_items i join public.event_agenda_days d on d.id=i.event_agenda_day_id where i.id=new.agenda_item_id and d.event_id=new.event_id and i.check_in) then
      raise exception 'Check-in requires an enabled item in the same event.' using hint='CHECK_IN_SESSIONS_CONFLICT';
    end if;
  elsif new.event_agenda_day_id is distinct from old.event_agenda_day_id then
    if exists(select 1 from public.check_in_sessions where agenda_item_id=old.id) then
      raise exception 'A mapped agenda item cannot be reassigned to another day.' using hint='CHECK_IN_SESSIONS_CONFLICT';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_agenda_binding() from public,anon,authenticated;
create trigger guard_agenda_session_binding before insert or update of agenda_item_id,event_id on public.check_in_sessions
for each row execute function public.guard_agenda_binding();
create trigger guard_agenda_item_parent before update of event_agenda_day_id on public.event_agenda_items
for each row execute function public.guard_agenda_binding();
