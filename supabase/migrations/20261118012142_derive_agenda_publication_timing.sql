-- Derive before the outer publication validator and operation receipt contract,
-- as well as inside the authoritative agenda/settings transaction.
alter function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)
rename to save_admin_event_builder_before_agenda_timing;
create function public.save_admin_event_builder(
  p_event_id uuid,p_draft_id uuid,p_draft_revision integer,p_event jsonb,p_slug text,
  p_expected_image_url text,p_expected_header_image_url text,p_check_in_sessions jsonb,
  p_application_questions jsonb,p_mentors jsonb,p_sponsors jsonb
) returns jsonb language plpgsql set search_path='' as $$
declare first_start timestamptz; last_end timestamptz;
begin
  if p_event #>> '{_date_location,version}'='2' then
    select min(public.agenda_pacific_instant(d->>'date',i->>'start')),
      max(public.agenda_pacific_instant(i->>'end_date',i->>'end')) into first_start,last_end
    from jsonb_array_elements(p_event #> '{_date_location,dates}') d
    cross join lateral jsonb_array_elements(d->'items') i;
    p_event:=p_event||jsonb_build_object('starts_at',first_start,'ends_at',last_end);
  end if;
  return public.save_admin_event_builder_before_agenda_timing(p_event_id,p_draft_id,p_draft_revision,p_event,p_slug,
    p_expected_image_url,p_expected_header_image_url,p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
end $$;
revoke all on function public.save_admin_event_builder_before_agenda_timing(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
