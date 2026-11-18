-- Project only participant fields. The private editor document is never returned.
create function public.participant_agenda_location(p_location jsonb, p_restricted boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select case when p_location is null or p_location = 'null'::jsonb then null
    when p_restricted then jsonb_build_object(
      'type', p_location->>'type', 'restricted', true,
      'public_summary', coalesce(p_location->>'public_summary', ''))
    else jsonb_strip_nulls(jsonb_build_object(
      'type', p_location->>'type', 'restricted', false,
      'building', case when p_location->>'type' <> 'online' then nullif(p_location->>'building','') end,
      'room', case when p_location->>'type' <> 'online' then nullif(p_location->>'room','') end,
      'address', case when p_location->>'type' <> 'online' then nullif(p_location->>'address','') end,
      'map_url', case when p_location->>'type' <> 'online' then nullif(p_location->>'map_url','') end,
      'meeting_url', case when p_location->>'type' <> 'in_person' then nullif(p_location->>'meeting_url','') end,
      'meeting_id', case when p_location->>'type' <> 'in_person' then nullif(p_location->>'meeting_id','') end,
      'meeting_passcode', case when p_location->>'type' <> 'in_person' then nullif(p_location->>'meeting_passcode','') end)) end;
$$;
revoke all on function public.participant_agenda_location(jsonb,boolean) from public,anon,authenticated;

-- No caller-supplied user ID or service-role authorization shortcut. Eligibility
-- is determined from the requesting viewer, including after the event ends.
create function public.event_participant_content(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events; config jsonb; day jsonb; item jsonb; loc jsonb;
  restricted boolean; days jsonb := '[]'; items jsonb; summary jsonb;
  staff boolean := public.is_admin(); d public.event_agenda_days; i public.event_agenda_items;
begin
  select * into e from public.events where id=p_event_id;
  if not found or not (staff or public.event_is_public(e.status,e.publish_at)) then
    return jsonb_build_object('location',null,'agenda','[]'::jsonb);
  end if;
  select document into config from public.event_date_location_settings where event_id=e.id;
  restricted := coalesce(config->>'audience','going') <> 'everyone' and not staff
    and not exists(select 1 from public.event_tickets t
      where t.event_id=e.id and t.user_id=public.current_user_info_id());
  -- The earliest dated day is the summary location, independent of display switch.
  select value into day from jsonb_array_elements(coalesce(config->'dates','[]'))
    order by value->>'date', value->>'key' limit 1;
  summary := public.participant_agenda_location(coalesce(nullif(day->'location','null'),config->'location'),restricted);
  if e.agenda_enabled then
    for d in select * from public.event_agenda_days where event_id=e.id order by date,id loop
      select value into day from jsonb_array_elements(coalesce(config->'dates','[]')) where value->>'key'=d.id::text;
      items := '[]';
      for i in select * from public.event_agenda_items where event_agenda_day_id=d.id order by starts_at,id loop
        select value into item from jsonb_array_elements(coalesce(day->'items','[]')) where value->>'key'=i.id::text;
        loc := coalesce(nullif(item->'location','null'),nullif(day->'location','null'),config->'location');
        items := items || jsonb_build_array(jsonb_build_object(
          'id',i.id,'title',i.title,'starts_at',i.starts_at,'ends_at',i.ends_at,
          'description',i.description,'check_in',i.check_in,
          'location_overridden',coalesce(item->'location','null'::jsonb)<>'null'::jsonb,
          'location',public.participant_agenda_location(loc,restricted)));
      end loop;
      days := days || jsonb_build_array(jsonb_build_object(
        'id',d.id,'date',d.date,'title',d.title,'items',items,
        'location',public.participant_agenda_location(coalesce(nullif(day->'location','null'),config->'location'),restricted)));
    end loop;
  end if;
  return jsonb_build_object('location',summary,'agenda',days);
end;
$$;
revoke all on function public.event_participant_content(uuid) from public;
grant execute on function public.event_participant_content(uuid) to anon,authenticated,service_role;

-- Existing normalized tables hold public projections only. Turning display off
-- hides direct participant reads as well; staff operations remain independent.
create policy "participant agenda display enabled" on public.event_agenda_days
  as restrictive for select to anon,authenticated
  using (public.is_admin() or exists(select 1 from public.events e where e.id=event_id and e.agenda_enabled));
create policy "participant agenda items display enabled" on public.event_agenda_items
  as restrictive for select to anon,authenticated
  using (public.is_admin() or exists(select 1 from public.event_agenda_days d where d.id=event_agenda_day_id));
