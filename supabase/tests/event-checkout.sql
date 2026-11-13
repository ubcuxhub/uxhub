-- Rollback-only coverage of exact own/club-term expiry boundaries.
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  v_user uuid;
  v_tier uuid;
  v_event uuid;
  v_result record;
  v_index integer;
begin
  -- CI applies migrations without seed data. Own this fixture so the active
  -- member case cannot silently become a non-member on an empty database.
  insert into public.membership_types(name,slug,description,price)
    values('RLS checkout boundary','rls-checkout-boundary','Rollback-only fixture',12)
    returning id into v_tier;
  insert into public.user_info(email,first_name,last_name,membership_type_id,membership_expires_at,role_access)
    values('rls-checkout-boundary@example.test','Boundary','Member',v_tier,now()+interval '1 year','basic') returning id into v_user;
  insert into public.events(name,description,slug,status,configured_pricing_mode,configured_price,max_capacity,regular_price,member_price)
    values('RLS checkout boundary','Rollback-only fixture','rls-checkout-boundary','active','paid',12.5,10,12.5,0) returning id into v_event;
  for v_index in 1..3 loop
    if v_index = 1 then
      update public.app_settings set membership_term_ends_at = now();
    elsif v_index = 2 then
      update public.app_settings set membership_term_ends_at = null;
      update public.user_info set membership_expires_at = now() where id = v_user;
    else
      update public.user_info set membership_expires_at = now()+interval '1 second' where id = v_user;
    end if;
    select * into v_result from public.initialize_event_checkout(v_event,v_user,'rls-checkout-boundary-'||v_index,true,0);
    if v_index < 3 and (v_result.failure_reason is distinct from 'PRICE_CHANGED' or v_result.amount_cents <> 1250) then
      raise exception 'expired membership received free pricing at exact boundary';
    end if;
    if v_index = 3 and (v_result.failure_reason is not null or v_result.amount_cents <> 0) then
      raise exception 'active membership did not receive free registration';
    end if;
  end loop;
  if has_function_privilege('anon','public.initialize_event_checkout(uuid,uuid,text,boolean,bigint)','execute')
    or has_function_privilege('authenticated','public.initialize_event_checkout(uuid,uuid,text,boolean,bigint)','execute') then
    raise exception 'browser role can initialize checkout';
  end if;
end $$;
