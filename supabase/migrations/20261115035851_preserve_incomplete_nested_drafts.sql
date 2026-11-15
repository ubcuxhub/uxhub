-- Unfinished sections retain their structural/URL validation, while completeness
-- belongs to publication. This also keeps compatibility-table mirrors saveable.
do $$ declare definition text; begin
 select pg_get_functiondef('public.validate_event_content(jsonb,boolean)'::regprocedure) into definition;
 definition:=replace(definition, 'if jsonb_array_length(s->''items'') = 0 then', 'if not p_draft and jsonb_array_length(s->''items'') = 0 then');
 definition:=replace(definition, 'if coalesce(t, '''') = '''' or length(t) > 120 or t = any(titles) or jsonb_typeof(s->''items'') <> ''array'' then',
   'if (not p_draft and (coalesce(t, '''') = '''' or t = any(titles))) or length(t) > 120 or jsonb_typeof(s->''items'') <> ''array'' then');
 definition:=replace(definition, 'if s->>''kind'' <> ''custom'' then', 'if not p_draft and s->>''kind'' <> ''custom'' then');
 definition:=replace(definition, 'elsif t in (''judges'',''mentors'',''speakers'',''panelists'',''sponsors'') then', 'elsif not p_draft and t in (''judges'',''mentors'',''speakers'',''panelists'',''sponsors'') then');
 execute definition;
 select pg_get_functiondef('public.guard_event_builder_settings()'::regprocedure) into definition;
 definition:=replace(definition, 'new.configured_pricing_mode is null and new.pricing_policy <> ''legacy'' then',
   'new.configured_pricing_mode is null and new.pricing_policy <> ''legacy'' and new.working_document is null then');
 execute definition;
 select pg_get_functiondef('public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid)'::regprocedure) into definition;
 definition:=replace(definition, '    null;', '    perform public.validate_event_content(s->''content'',true);');
 execute definition;
 select pg_get_functiondef('public.normalize_unfinished_event()'::regprocedure) into definition;
 definition:=replace(definition, 'if new.working_document is not null then',
   'if new.working_document is not null then
      if new.header_colour !~ ''^#[0-9A-Fa-f]{6}$'' then new.header_colour:=null; end if;
      if new.event_colour !~ ''^#[0-9A-Fa-f]{6}$'' then new.event_colour:=null; end if;');
 execute definition;
 select pg_get_functiondef('public.update_admin_event_schedule(uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition, 'document:=e.working_document;',
   'document:=e.working_document;
    if jsonb_array_length(document #> ''{formState,date_location,dates}'') > 1 and
       (e.starts_at,e.ends_at) is distinct from ((p_patch->>''starts_at'')::timestamptz,(p_patch->>''ends_at'')::timestamptz) then
      raise exception ''Edit individual event dates in the event form.'' using hint=''EVENT_SETTINGS_CONFLICT'';
    end if;
    if jsonb_array_length(document #> ''{formState,date_location,dates}'') = 1 then
      document:=jsonb_set(document,''{formState,date_location,dates,0,date}'',to_jsonb(coalesce(to_char((p_patch->>''starts_at'')::timestamptz at time zone ''America/Vancouver'',''YYYY-MM-DD''),'''')));
      document:=jsonb_set(document,''{formState,date_location,dates,0,start}'',to_jsonb(coalesce(to_char((p_patch->>''starts_at'')::timestamptz at time zone ''America/Vancouver'',''HH24:MI''),'''')));
      document:=jsonb_set(document,''{formState,date_location,dates,0,end}'',to_jsonb(coalesce(to_char((p_patch->>''ends_at'')::timestamptz at time zone ''America/Vancouver'',''HH24:MI''),'''')));
    end if;');
 execute definition;
end $$;
