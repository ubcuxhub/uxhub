-- Clearing an unfinished name does not rename an existing canonical URL.
-- A first save without a name still allocates a numbered 'event' URL.
do $$ declare definition text; begin
 select pg_get_functiondef('public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'if base = '''' then base := ''event''; end if;',
   'if base = '''' then base := coalesce(e.slug,''event''); end if;');
 execute definition;
end $$;
