-- Keep compatibility sessions, but staff mutations identify the enabled item.
-- Attendance versions are independent of timestamps and survive duplicate scans.
alter table public.check_ins add column attendance_version uuid not null default gen_random_uuid();
create table public.check_in_activity (
  attendance_version uuid primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  item_id uuid not null references public.event_agenda_items(id) on delete cascade,
  ticket_id uuid not null references public.event_tickets(id) on delete cascade,
  operator_id uuid references public.user_info(id) on delete set null,
  method text not null check (method in ('scan','manual')),
  checked_in_at timestamptz not null,
  undone_at timestamptz
);
create index check_in_activity_item_time on public.check_in_activity(item_id,checked_in_at desc);
alter table public.check_in_activity enable row level security;
revoke all on public.check_in_activity from anon,authenticated;
grant select on public.check_in_activity to authenticated;
grant all on public.check_in_activity to service_role;
create policy "staff read check-in activity" on public.check_in_activity
for select to authenticated using(public.is_admin());
-- Authenticated callers cannot bypass attribution or version-guarded undo.
revoke insert,update,delete on public.check_ins from anon,authenticated;

-- Every path, including trusted compatibility writes, checks ticket ownership.
create or replace function public.guard_agenda_check_in_target() returns trigger
language plpgsql security definer set search_path='' as $$
declare session public.check_in_sessions; item public.event_agenda_items;
begin
  select * into session from public.check_in_sessions where id=new.check_in_session_id for key share;
  if not found or not exists(select 1 from public.event_tickets where id=new.ticket_id and event_id=session.event_id) then
    raise exception 'Ticket does not belong to the check-in event.';
  end if;
  if session.agenda_item_id is not null then
    select * into item from public.event_agenda_items where id=session.agenda_item_id for share;
    if not found or not item.check_in then raise exception 'This item does not accept check-in.'; end if;
  end if;
  if tg_op='UPDATE' and (new.checked_in_at is distinct from old.checked_in_at
      or new.ticket_id is distinct from old.ticket_id or new.check_in_session_id is distinct from old.check_in_session_id) then
    new.attendance_version:=gen_random_uuid();
  end if;
  return new;
end $$;
drop trigger guard_agenda_check_in_target on public.check_ins;
create trigger guard_agenda_check_in_target before insert or update on public.check_ins
for each row execute function public.guard_agenda_check_in_target();

create function public.mutate_item_check_in(
  p_event_id uuid, p_item_id uuid, p_ticket_id uuid default null,
  p_qr_token text default null, p_method text default 'manual',
  p_undo_version uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  sid uuid; tid uuid; attendee text; attendance public.check_ins;
  operator uuid; duplicate boolean:=false;
begin
  if not public.is_admin() then raise exception 'Staff access required.' using errcode='42501'; end if;
  operator:=public.current_user_info_id();
  if operator is null then raise exception 'Staff identity required.' using errcode='42501'; end if;
  if p_method not in ('scan','manual') then raise exception 'Invalid check-in method.'; end if;
  -- Same lock order as builder: event -> session -> item. Serializes mutations
  -- and agenda changes, including undo/rescan and disable/delete races.
  perform 1 from public.events where id=p_event_id for update;
  if not found then raise exception 'Event unavailable.'; end if;
  select s.id into sid from public.check_in_sessions s
    where s.event_id=p_event_id and s.agenda_item_id=p_item_id for update;
  if sid is null then raise exception 'Check-in item unavailable.'; end if;
  perform 1 from public.event_agenda_items i join public.event_agenda_days d on d.id=i.event_agenda_day_id
    where i.id=p_item_id and d.event_id=p_event_id and i.check_in for share of i,d;
  if not found then raise exception 'Check-in item unavailable.'; end if;
  select t.id,coalesce(nullif(trim(concat_ws(' ',u.first_name,u.last_name)),''),'Unknown User')
    into tid,attendee from public.event_tickets t left join public.user_info u on u.id=t.user_id
    where t.event_id=p_event_id and
      ((p_method='scan' and p_qr_token ~ '^[0-9a-f]{32}$' and t.qr_token=p_qr_token)
       or (p_method='manual' and t.id=p_ticket_id)) for key share of t;
  if tid is null then return jsonb_build_object('status','rejected','reason','not_found'); end if;
  select * into attendance from public.check_ins where ticket_id=tid and check_in_session_id=sid for update;
  if p_undo_version is not null then
    if attendance.id is null or attendance.checked_in_at is null or attendance.attendance_version<>p_undo_version then
      return jsonb_build_object('status','stale_undo');
    end if;
    delete from public.check_ins where id=attendance.id;
    update public.check_in_activity set undone_at=clock_timestamp() where attendance_version=p_undo_version;
    return jsonb_build_object('status','undone');
  end if;
  if attendance.checked_in_at is not null then duplicate:=true;
  elsif attendance.id is not null then
    update public.check_ins set checked_in_at=clock_timestamp() where id=attendance.id returning * into attendance;
  else
    insert into public.check_ins(ticket_id,check_in_session_id,checked_in_at)
      values(tid,sid,clock_timestamp()) returning * into attendance;
  end if;
  if not duplicate then
    insert into public.check_in_activity(attendance_version,event_id,item_id,ticket_id,operator_id,method,checked_in_at)
      values(attendance.attendance_version,p_event_id,p_item_id,tid,operator,p_method,attendance.checked_in_at);
  end if;
  return jsonb_build_object('status',case when duplicate then 'already_checked_in' else 'checked_in' end,
    'name',attendee,'ticketId',tid,'attendanceVersion',attendance.attendance_version,'checkedInAt',attendance.checked_in_at,
    'checkedCount',(select count(*) from public.check_ins c join public.event_tickets t on t.id=c.ticket_id where c.check_in_session_id=sid and c.checked_in_at is not null and t.event_id=p_event_id),
    'total',(select count(*) from public.event_tickets where event_id=p_event_id));
end $$;
revoke all on function public.mutate_item_check_in(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.mutate_item_check_in(uuid,uuid,uuid,text,text,uuid) to authenticated;
