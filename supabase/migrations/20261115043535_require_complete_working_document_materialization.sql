-- Optional sections are optional to include, not permission to silently drop a
-- saved unfinished section by omitting its payload during materialization.
do $$ declare definition text; begin
 select pg_get_functiondef('public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'    if p_event->>''configured_slug_edited''=''false'' then',
   '    if receipt.id is null and e.working_document is not null then
      if e.working_document #> ''{formState,content}'' is not null and e.working_document #> ''{formState,content}'' <> ''null''::jsonb
        and (p_event->''_content'' is null or p_event->''_content''=''null''::jsonb) then
        raise exception ''Reload saved people and resources before publishing.'' using hint=''EVENT_CONTENT_INVALID'';
      end if;
      if e.working_document #> ''{formState,date_location}'' is not null and e.working_document #> ''{formState,date_location}'' <> ''null''::jsonb
        and (p_event->''_date_location'' is null or p_event->''_date_location''=''null''::jsonb) then
        raise exception ''Reload saved dates and locations before publishing.'' using hint=''EVENT_SETTINGS_CONFLICT'';
      end if;
      if (nullif(e.working_document #>> ''{formState,decisions_release_at}'','''') is not null or nullif(e.working_document #>> ''{formState,confirmation_deadline}'','''') is not null)
        and (p_event->''_application_timing'' is null or p_event->''_application_timing''=''null''::jsonb) then
        raise exception ''Reload saved application timing before publishing.'' using hint=''EVENT_SETTINGS_CONFLICT'';
      end if;
    end if;
    if p_event->>''configured_slug_edited''=''false'' then');
 execute definition;
end $$;
