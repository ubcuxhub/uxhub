-- Agenda item links (Figma "Agenda", 4640:844): an agenda item's title can link
-- to a resource, such as a slides template. The link is an ordinary event_links
-- row that names its agenda item, so it keeps the link's own visibility (RLS)
-- and still shows wherever its type normally shows.
--
-- The column is nullable and every existing writer leaves it out, so the code
-- already deployed is unaffected. Builder resource saves delete and re-insert
-- event_links (save_event_resources) without this column, so a save clears an
-- item's link until the builder learns to send it.

alter table public.event_links
  -- At most one link per item, and it goes when its item is deleted.
  add column agenda_item_id uuid unique
    references public.event_agenda_items(id) on delete cascade;

-- event_agenda_items carries no event_id, so a foreign key can't keep the link
-- and its item on the same event; this trigger does.
create function public.event_links_agenda_item_same_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.agenda_item_id is not null and not exists (
    select 1
    from public.event_agenda_items item
    join public.event_agenda_days day on day.id = item.event_agenda_day_id
    where item.id = new.agenda_item_id
      and day.event_id = new.event_id
  ) then
    raise exception 'An agenda item link must belong to the same event as its item.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger event_links_agenda_item_same_event
  before insert or update of agenda_item_id, event_id on public.event_links
  for each row execute function public.event_links_agenda_item_same_event();

-- ── event_participant_content ────────────────────────────────────────────
--
-- Unchanged from 20261118012144 except that each day now says whether it set
-- its own location (`location_overridden`), as items already do, so a day
-- heading can name a venue only when it differs from the event's.

create or replace function public.event_participant_content(p_event_id uuid)
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
        'location_overridden',coalesce(day->'location','null'::jsonb)<>'null'::jsonb,
        'location',public.participant_agenda_location(coalesce(nullif(day->'location','null'),config->'location'),restricted)));
    end loop;
  end if;
  return jsonb_build_object('location',summary,'agenda',days);
end;
$$;
revoke all on function public.event_participant_content(uuid) from public;
grant execute on function public.event_participant_content(uuid) to anon,authenticated,service_role;
