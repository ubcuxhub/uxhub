-- Schedule edits use the same durable receipt and revision contract as the
-- builder. The definer is limited to staff/service callers and explicit fields;
-- browser callers cannot write or read the private receipt table themselves.
do $$ declare definition text; begin
 select pg_get_functiondef('public.update_admin_event_schedule(uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'declare e public.events; document jsonb; field text;',
   'declare e public.events; document jsonb; field text; saved_row public.events; op uuid:=(p_patch->>''_operation_id'')::uuid; receipt public.admin_event_mutations; req jsonb;');
 definition:=replace(definition,' perform pg_catalog.pg_advisory_xact_lock(20270101,13);',
   ' if auth.role() is distinct from ''service_role'' and not coalesce(public.is_admin(),false) then raise exception ''Staff access required.'' using errcode=''42501''; end if;
     perform pg_catalog.pg_advisory_xact_lock(20270101,13);
     req:=jsonb_build_object(''kind'',''schedule'',''event_id'',p_event_id,''patch'',p_patch);
     if op is not null then
       select * into receipt from public.admin_event_mutations where id=op;
       if found then
         if receipt.request<>req then raise exception ''This retry differs from the original request.'' using hint=''EVENT_REVISION_CONFLICT''; end if;
         return query select * from jsonb_populate_record(null::public.events,receipt.result);
         return;
       end if;
     end if;');
 definition:=replace(definition,'and saved.working_document is not null;',
   'and saved.working_document is not null;
    if op is not null then
      select * into saved_row from public.events where id=p_event_id;
      insert into public.admin_event_mutations(id,request,result) values(op,req,to_jsonb(saved_row));
    end if;');
 execute definition;
end $$;
alter function public.update_admin_event_schedule(uuid,jsonb) security definer;
