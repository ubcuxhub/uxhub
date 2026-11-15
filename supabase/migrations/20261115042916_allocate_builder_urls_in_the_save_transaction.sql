-- The server's suggested URL is optimistic. Arbitrate automatic collisions
-- under the same lock as draft saves, and return/receipt the actual canonical
-- URL. Two complete saves must not turn an automatic collision into a refusal.
do $$ declare definition text; begin
 select pg_get_functiondef('public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'receipt public.admin_event_mutations;',
   'receipt public.admin_event_mutations; base text; candidate text; suffix text; counter integer:=0; canonical text; canonical_receipt jsonb;');
 definition:=replace(definition,'  if p_draft_id is not null then',
   '  op:=(p_event->>''_operation_id'')::uuid;
    if op is not null then select * into receipt from public.admin_event_mutations where id=op; end if;
    if p_draft_id is not null then');
 definition:=replace(definition,'  result:=public.save_admin_event_builder_before_unified_drafts(',
   '  if eid is not null then select * into e from public.events where id=eid for update; end if;
    if p_event->>''configured_slug_edited''=''false'' then
      if receipt.id is not null and receipt.request #> ''{event,configured_slug}'' is not null then
        p_event:=jsonb_set(p_event,''{configured_slug}'',receipt.request #> ''{event,configured_slug}'');
      elsif e.first_published_at is null then
        base:=rtrim(left(btrim(regexp_replace(lower(btrim(coalesce(p_event->>''name'',e.name,''''))),''[^a-z0-9]+'',''-'',''g''),''-''),100),''-'');
        if base='''' then base:=coalesce(e.slug,''event''); end if;
        if base in (''new'',''create'',''create-new'',''admin'',''api'',''auth'',''portal'',''events'',''drafts'',''dev'',''settings'') then base:=base||''-event''; end if;
        candidate:=base; suffix:=substring(e.slug from ''-[0-9]+$'');
        if suffix is not null and e.slug=rtrim(left(base,100-length(suffix)),''-'')||suffix then candidate:=e.slug; end if;
        loop
          exit when not exists(select 1 from public.event_url_claims where slug=candidate and event_id is distinct from eid)
            and not exists(select 1 from public.events where slug=candidate and id is distinct from eid);
          counter:=counter+1; suffix:=''-''||counter; candidate:=rtrim(left(base,100-length(suffix)),''-'')||suffix;
        end loop;
        p_event:=jsonb_set(p_event,''{configured_slug}'',to_jsonb(candidate));
        if eid is null then p_slug:=candidate; end if;
      end if;
    end if;
    result:=public.save_admin_event_builder_before_unified_drafts(');
 definition:=replace(definition,'  return result;',
   '  select slug into canonical from public.events where id=(result->>''id'')::uuid;
    canonical:=coalesce(canonical,result->>''page_slug'',receipt.result->>''page_slug'');
    result:=result||jsonb_build_object(''page_slug'',canonical);
    canonical_receipt:=result;
    if op is not null then update public.admin_event_mutations set result=canonical_receipt where id=op; end if;
    return result;');
 execute definition;
end $$;
