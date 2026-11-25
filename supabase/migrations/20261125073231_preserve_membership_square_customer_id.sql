-- Preserve an existing Square customer when a purchase has no customer ID.
-- CREATE OR REPLACE retains the existing service-role-only grants.
create or replace function public.fulfill_membership_purchase(p_purchase_id uuid, p_expires_at timestamptz)
returns public.purchases language plpgsql security definer set search_path = '' as $$
declare p public.purchases; prior_setting text := current_setting('uxhub.membership_purchase', true);
begin
  select * into strict p from public.purchases where id = p_purchase_id for update;
  if p.kind <> 'membership' or p.status <> 'completed' or p.membership_type_id is null then
    raise exception 'Completed membership purchase required';
  end if;
  if p.fulfilled_at is not null then return p; end if;
  -- Lock profile before taking the history lock, matching manual update order.
  perform 1 from public.user_info where id = p.user_id and deleted_at is null for update;
  if not found then raise exception 'Active user required'; end if;
  perform set_config('uxhub.membership_purchase', 'on', true);
  update public.user_info set membership_expires_at = p_expires_at,
    membership_pre_ordered_type_id = null, membership_type_id = p.membership_type_id,
    square_customer_id = coalesce(p.square_customer_id, user_info.square_customer_id) where id = p.user_id;
  update public.purchases set fulfilled_at = now() where id = p.id returning * into p;
  perform set_config('uxhub.membership_purchase', coalesce(prior_setting, ''), true);
  return p;
end;
$$;
