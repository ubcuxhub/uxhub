-- A rolling window must use actual award timestamps, never monthly buckets.
create index membership_awards_awarded_at_idx on public.membership_awards (awarded_at);

create function public.admin_recent_membership_additions(p_now timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  window_start timestamptz := p_now - interval '720 hours';
  tracking_start timestamptz;
  total bigint;
  coverage text;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_now is null then raise exception 'Report time required'; end if;
  select complete_from into strict tracking_start from public.membership_history_coverage where id;
  select count(distinct person_id) into total from public.membership_awards
    where awarded_at >= window_start and awarded_at <= p_now;
  coverage := case when window_start >= tracking_start then 'complete'
    when total > 0 or p_now >= tracking_start then 'partial' else 'unavailable' end;
  return jsonb_build_object('count', case when coverage = 'unavailable' then null else total end,
    'coverage', coverage);
end;
$$;
revoke all on function public.admin_recent_membership_additions(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_recent_membership_additions(timestamptz) to authenticated;
