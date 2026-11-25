-- Ticket release, check-in and offers (payments audit).
--
-- 1. release_event_ticket frees the seat of a ticket whose payment hold was
--    voided or failed. It deleted the ticket directly, skipping the event
--    lock and the team hand-off remove_event_ticket does, so a holder who
--    had made or joined a team during the hold kept a team spot with no
--    ticket. It now goes through remove_event_ticket.
-- 2. mutate_item_check_in refuses a ticket whose purchase Square has not
--    captured yet (pending or authorized): the hold may still be voided, and
--    a ticket checked in during that window was kept for free, because
--    release_event_ticket leaves checked-in tickets alone.
-- 3. Taking a ticket back (void_event_ticket, or a full refund through
--    apply_event_purchase_refund) also ends the holder's accepted offer on an
--    application event. The offer otherwise counted as a held seat again and
--    let the same person register again.
--
-- Backward compatible: every function keeps its signature and result shape.
-- Check-in gains one rejection reason, `payment_pending`.

-- 1. Release ------------------------------------------------------------------

create or replace function public.release_event_ticket(p_purchase_id uuid)
returns void
language plpgsql set search_path = '' as $$
declare
  v_event_id uuid;
  v_ticket_id uuid;
begin
  select event_id into v_event_id from public.purchases where id = p_purchase_id;
  if v_event_id is null then return; end if;
  -- The lock remove_event_ticket takes, held first so the checks below see
  -- the purchase and check-ins as they stand when the ticket goes.
  perform 1 from public.events where id = v_event_id for update;

  for v_ticket_id in
    select ticket.id
    from public.event_tickets ticket
    join public.purchases purchase on purchase.id = ticket.purchase_id
    where ticket.purchase_id = p_purchase_id
      and purchase.status <> 'completed'
      and not exists (
        select 1 from public.check_ins check_in
        where check_in.ticket_id = ticket.id
      )
  loop
    perform public.remove_event_ticket(v_ticket_id);
  end loop;
end;
$$;

revoke all on function public.release_event_ticket(uuid) from public, anon, authenticated;
grant execute on function public.release_event_ticket(uuid) to service_role;

-- 2. Check-in -----------------------------------------------------------------

create or replace function public.mutate_item_check_in(
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
  -- A ticket is reserved before its payment is captured. Until Square
  -- captures it the hold may still be voided, which takes the ticket back.
  if p_undo_version is null and exists (
    select 1 from public.event_tickets t join public.purchases p on p.id=t.purchase_id
    where t.id=tid and p.status in ('pending','authorized')
  ) then
    return jsonb_build_object('status','rejected','reason','payment_pending');
  end if;
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

-- 3. Offers -------------------------------------------------------------------

-- Ends a person's accepted, unexpired offer on an application event, so a
-- ticket taken back stops holding a seat and can't be registered for again.
-- The application stays accepted, with the offer lapsing now. The caller
-- holds the event lock.
create function public.end_event_offer(p_event_id uuid, p_user_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.event_applications application
  set offer_expires_at = now()
  from public.events event
  where event.id = p_event_id
    and event.requires_application
    and application.event_id = p_event_id
    and application.user_id = p_user_id
    and application.status = 'accepted'
    and application.offer_expires_at > now();
$$;

revoke all on function public.end_event_offer(uuid, uuid) from public, anon, authenticated;

create or replace function public.apply_event_purchase_refund(
  p_purchase_id uuid,
  p_refunded_cents integer
)
returns table (
  refunded_total_cents integer,
  fully_refunded boolean,
  amount_increased boolean,
  ticket_removed boolean,
  kept_checked_in_ticket boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_purchase public.purchases%rowtype;
  v_total integer;
  v_increased boolean := false;
  v_full boolean;
  v_ticket_id uuid;
  v_removed boolean := false;
  v_kept boolean := false;
begin
  if p_refunded_cents is null or p_refunded_cents < 0 then
    raise exception 'A refunded amount is zero or more cents.' using errcode = '22023';
  end if;

  select event_id into v_event_id from public.purchases where id = p_purchase_id;
  if not found then return; end if;
  -- The lock reservation and remove_event_ticket take, in the same order.
  if v_event_id is not null then
    perform 1 from public.events where id = v_event_id for update;
  end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then return; end if;

  v_total := least(p_refunded_cents, v_purchase.amount_cents);
  if v_total > v_purchase.refunded_cents then
    update public.purchases
    set refunded_cents = v_total, refunded_at = now()
    where id = p_purchase_id;
    v_increased := true;
  else
    v_total := v_purchase.refunded_cents;
  end if;

  v_full := v_purchase.amount_cents > 0 and v_total >= v_purchase.amount_cents;

  -- Runs on every delivery, not only the one that raised the amount, so a
  -- ticket issued in a race before the refund was recorded still goes.
  if v_full and v_purchase.kind = 'event_ticket' then
    select id into v_ticket_id from public.event_tickets where purchase_id = p_purchase_id;
    if found then
      if exists (
        select 1 from public.check_ins
        where ticket_id = v_ticket_id and checked_in_at is not null
      ) then
        v_kept := true;
      else
        v_removed := public.remove_event_ticket(v_ticket_id);
        if v_removed then
          perform public.end_event_offer(v_purchase.event_id, v_purchase.user_id);
        end if;
      end if;
    end if;
  end if;

  return query select v_total, v_full, v_increased, v_removed, v_kept;
end;
$$;

create or replace function public.void_event_ticket(p_ticket_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_ticket public.event_tickets%rowtype;
  v_purchase public.purchases%rowtype;
begin
  select event_id into v_event_id from public.event_tickets where id = p_ticket_id;
  if not found then return 'TICKET_NOT_FOUND'; end if;
  perform 1 from public.events where id = v_event_id for update;
  select * into v_ticket from public.event_tickets where id = p_ticket_id for update;
  if not found then return 'TICKET_NOT_FOUND'; end if;

  if exists (
    select 1 from public.check_ins
    where ticket_id = p_ticket_id and checked_in_at is not null
  ) then
    return 'TICKET_CHECKED_IN';
  end if;

  if v_ticket.purchase_id is not null then
    select * into v_purchase from public.purchases where id = v_ticket.purchase_id for update;
    if found and v_purchase.amount_cents > 0 and public.purchase_is_live(v_purchase.id) then
      return 'TICKET_PAID';
    end if;
  end if;

  perform public.remove_event_ticket(p_ticket_id);
  perform public.end_event_offer(v_ticket.event_id, v_ticket.user_id);

  if v_purchase.id is not null and v_purchase.amount_cents = 0 and v_purchase.status = 'completed' then
    update public.purchases
    set status = 'canceled', failure_reason = 'An admin voided this registration.'
    where id = v_purchase.id;
  end if;

  return null;
end;
$$;
