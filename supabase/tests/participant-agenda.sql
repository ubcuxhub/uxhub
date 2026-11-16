-- The participant RPC is callable by viewers; its internal location projector
-- cannot be invoked directly to bypass event/audience authorization.
do $$ begin
  if not has_function_privilege('anon','public.event_participant_content(uuid)','execute')
     or not has_function_privilege('authenticated','public.event_participant_content(uuid)','execute') then
    raise exception 'participant projection is unavailable to viewer roles';
  end if;
  if has_function_privilege('anon','public.participant_agenda_location(jsonb,boolean)','execute')
     or has_function_privilege('authenticated','public.participant_agenda_location(jsonb,boolean)','execute') then
    raise exception 'internal location projector is exposed';
  end if;
end $$;
set local role anon;
do $$ begin
  if public.event_participant_content(gen_random_uuid()) <> '{"location":null,"agenda":[]}'::jsonb then
    raise exception 'unknown events return participant data';
  end if;
end $$;
reset role;
