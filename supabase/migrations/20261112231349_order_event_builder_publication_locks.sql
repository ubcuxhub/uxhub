-- Preserve the scheduler lock order before checking the lifecycle snapshot.
create or replace function public.save_admin_event_builder(
  p_event_id uuid, p_draft_id uuid, p_draft_revision integer,
  p_event jsonb, p_slug text, p_expected_image_url text,
  p_expected_header_image_url text, p_check_in_sessions jsonb,
  p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  current_event public.events;
  saved_event public.events;
  draft public.admin_event_drafts;
  expected jsonb := p_event->'_expected_publication';
  result jsonb;
  replay boolean := false;
begin
  -- The scheduler takes this advisory lock before event rows. Acquire it
  -- before draft/event row locks as well, including materialization replays.
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  -- Match the existing materializer's lock order and durable response-loss key.
  if p_draft_id is not null then
    select * into draft from public.admin_event_drafts where id = p_draft_id for update;
    replay := found and draft.materialized and p_event_id is null;
  end if;
  if p_event_id is not null then
    select * into current_event from public.events where id = p_event_id for update;
    if not found then raise exception 'Event not found.' using hint = 'EVENT_PUBLICATION_CONFLICT'; end if;
    if expected is not null and expected <> 'null'::jsonb and
      (current_event.status::text, current_event.publish_at) is distinct from
      (expected->>'status', (expected->>'publish_at')::timestamptz) then
      raise exception 'The publication status or schedule changed elsewhere. Reload before saving; your edits are still here.' using hint = 'EVENT_PUBLICATION_CONFLICT';
    end if;
  end if;
  if not replay and (p_event->>'status' = 'active' or nullif(p_event->>'publish_at','') is not null) then
    if btrim(coalesce(p_event->>'name','')) = '' then raise exception 'Event name is required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if btrim(coalesce(p_event->>'short_description','')) = '' then raise exception 'Short description is required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if coalesce(p_event->>'configured_marketing_mode','hosted') <> 'disabled' and btrim(coalesce(p_event->>'description','')) = '' then raise exception 'Description is required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if length(p_event->>'short_description') > 50 or length(p_event->>'description') > 3000 then raise exception 'Overview exceeds its character limit.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if p_event->>'starts_at' is null or p_event->>'ends_at' is null then raise exception 'Event start and end dates and times are required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if (p_event->>'starts_at')::timestamptz >= (p_event->>'ends_at')::timestamptz then raise exception 'Event end time must be after the start time.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if p_event->>'max_capacity' is null or (p_event->>'max_capacity')::numeric < 0 or (p_event->>'max_capacity')::numeric <> trunc((p_event->>'max_capacity')::numeric) then raise exception 'Capacity must be a nonnegative whole number.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if (p_event->>'requires_application')::boolean and jsonb_array_length(coalesce(p_application_questions,'[]')) = 0 then raise exception 'Applications require at least one valid question before publication.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    if nullif(p_event->>'publish_at','') is not null and nullif(p_event->>'registration_closes_at','') is not null and (p_event->>'publish_at')::timestamptz >= (p_event->>'registration_closes_at')::timestamptz then raise exception 'Publish time must be before registration closes.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
  end if;
  result := public.save_admin_event_builder_before_publication(p_event_id,p_draft_id,p_draft_revision,p_event - '_expected_publication',p_slug,p_expected_image_url,p_expected_header_image_url,p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
  select * into saved_event from public.events where id = (result->>'id')::uuid;
  -- A replay reports the current saved lifecycle, including cron publishing
  -- after a scheduled request whose response the browser never received.
  return result || jsonb_build_object('publication', jsonb_build_object(
    'id',saved_event.id,'name',saved_event.name,'status',saved_event.status,
    'publish_at',saved_event.publish_at,'registration_opens_at',saved_event.registration_opens_at,
    'registration_closes_at',saved_event.registration_closes_at));
end $$;
revoke all on function public.save_admin_event_builder_before_publication(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
