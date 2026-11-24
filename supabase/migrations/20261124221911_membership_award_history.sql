-- Durable person/year awards deliberately have no profile/purchase FK: account
-- deletion and refunds must not erase history. No names, emails or tier data.
create table public.membership_awards (
  person_id uuid not null,
  academic_year integer not null check (academic_year between 1900 and 9998),
  awarded_at timestamptz not null,
  month date not null,
  source text not null check (source in ('purchase', 'manual')),
  primary key (person_id, academic_year),
  check (extract(month from month) in (9,10,11,12,1,2,3,4)),
  check (month = date_trunc('month', awarded_at at time zone 'America/Vancouver')::date),
  check (academic_year = extract(year from month)::integer - case when extract(month from month) < 9 then 1 else 0 end)
);
create table public.membership_award_months (
  month date primary key,
  total bigint not null check (total >= 0)
);
create table public.membership_history_coverage (
  id boolean primary key default true check (id),
  complete_from timestamptz not null
);
insert into public.membership_history_coverage values (true, now());

alter table public.membership_awards enable row level security;
alter table public.membership_award_months enable row level security;
alter table public.membership_history_coverage enable row level security;
revoke all on public.membership_awards, public.membership_award_months, public.membership_history_coverage from anon, authenticated;
grant all on public.membership_awards, public.membership_award_months, public.membership_history_coverage to service_role;

-- A transaction lock serializes ledger mutations and rebuilds, including imports
-- which move a first award to an earlier month. Summary deltas cannot be lost.
create function public.lock_membership_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(74623819001);
  return null;
end;
$$;
create trigger membership_awards_lock before insert or update or delete on public.membership_awards
for each statement execute function public.lock_membership_history();

create function public.sync_membership_award_month() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    update public.membership_award_months set total = total - 1 where month = old.month;
    delete from public.membership_award_months where month = old.month and total = 0;
  end if;
  if tg_op <> 'DELETE' then
    insert into public.membership_award_months (month, total) values (new.month, 1)
    on conflict (month) do update set total = public.membership_award_months.total + 1;
  end if;
  return null;
end;
$$;
create trigger membership_awards_summary after insert or update or delete on public.membership_awards
for each row execute function public.sync_membership_award_month();

create function public.record_membership_award(p_person_id uuid, p_awarded_at timestamptz, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare local_date date := (p_awarded_at at time zone 'America/Vancouver')::date;
begin
  if extract(month from local_date) between 5 and 8 then return; end if;
  perform pg_advisory_xact_lock(74623819001);
  insert into public.membership_awards (person_id, academic_year, awarded_at, month, source)
  values (p_person_id, extract(year from local_date)::integer - case when extract(month from local_date) < 9 then 1 else 0 end,
    p_awarded_at, date_trunc('month', local_date)::date, p_source)
  on conflict (person_id, academic_year) do update
  set awarded_at = excluded.awarded_at, month = excluded.month, source = excluded.source
  where excluded.awarded_at < public.membership_awards.awarded_at;
end;
$$;

-- Retain compatibility with the deployed fulfillment writer and seed imports.
create function public.record_fulfilled_membership_award() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'membership' and new.status = 'completed' and new.fulfilled_at is not null then
    perform public.record_membership_award(new.user_id, new.fulfilled_at, 'purchase');
  end if;
  return null;
end;
$$;
create trigger purchase_membership_award after insert or update of fulfilled_at, status on public.purchases
for each row execute function public.record_fulfilled_membership_award();

-- Both existing admin-edit paths update this privileged column. Unrelated
-- profile edits, expiry, deletion and unfulfilled preorders never create awards.
create function public.record_manual_membership_award() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('uxhub.membership_purchase', true) = 'on'
    or old.membership_type_id is not distinct from new.membership_type_id then return null; end if;
  if new.membership_type_id is not null and new.deleted_at is null
    and (new.membership_expires_at is null or new.membership_expires_at > now())
    and not exists (select 1 from public.app_settings where membership_term_ends_at <= now()) then
    perform public.record_membership_award(new.id, now(), 'manual');
  end if;
  return null;
end;
$$;
create trigger profile_manual_membership_award after update of membership_type_id on public.user_info
for each row execute function public.record_manual_membership_award();

-- Commit the actual grant, fulfillment marker and ledger together. Caller still
-- computes expiry with the existing JS policy; no expiry/checkout rules change.
create function public.fulfill_membership_purchase(p_purchase_id uuid, p_expires_at timestamptz)
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
    square_customer_id = p.square_customer_id where id = p.user_id;
  update public.purchases set fulfilled_at = now() where id = p.id returning * into p;
  perform set_config('uxhub.membership_purchase', coalesce(prior_setting, ''), true);
  return p;
end;
$$;

-- Reliable imports are repeatable; undated manual grants cannot be recovered.
create function public.rebuild_membership_history() returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform pg_advisory_xact_lock(74623819001);
  for p in select user_id, fulfilled_at from public.purchases
    where kind = 'membership' and status = 'completed' and fulfilled_at is not null
    order by fulfilled_at, id
  loop
    perform public.record_membership_award(p.user_id, p.fulfilled_at, 'purchase');
  end loop;
  delete from public.membership_award_months where month is not null;
  insert into public.membership_award_months select month, count(*) from public.membership_awards group by month;
end;
$$;
select public.rebuild_membership_history();

create function public.admin_membership_history(p_now timestamptz default now(), p_first_year integer default null, p_last_year integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  local_now timestamp := p_now at time zone 'America/Vancouver';
  latest_year integer := extract(year from local_now)::integer - case when extract(month from local_now) < 9 then 1 else 0 end;
  first_year integer;
  last_year integer := coalesce(p_last_year, latest_year);
  tracking_start timestamptz;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_now is null then raise exception 'Report time required'; end if;
  select complete_from into strict tracking_start from public.membership_history_coverage where id;
  select coalesce(p_first_year, least(latest_year,
    extract(year from tracking_start at time zone 'America/Vancouver')::integer - case when extract(month from tracking_start at time zone 'America/Vancouver') < 9 then 1 else 0 end,
    (select min(academic_year) from public.membership_awards))) into first_year;
  if first_year < 1900 or last_year > 9998 or last_year < first_year or last_year - first_year > 200 then
    raise exception 'Invalid academic year range';
  end if;
  with periods as (
    select y as year, (make_date(y,9,1) + (m || ' months')::interval)::date as month
    from generate_series(first_year, last_year) y cross join generate_series(0,7) m
  ), counts as (
    select month, count(*) as total from public.membership_awards where awarded_at <= p_now group by month
  ), months as (
    select p.*, case
      when p.month::timestamp > local_now then 'future'
      when make_date(p.year,9,1)::timestamp at time zone 'America/Vancouver' >= tracking_start then 'complete'
      when coalesce(c.total,0) > 0 or (p_now >= tracking_start and (p.month + interval '1 month') at time zone 'America/Vancouver' > tracking_start) then 'partial'
      else 'unavailable' end as coverage,
      coalesce(c.total,0) as total
    from periods p left join counts c using (month)
  ), years as (
    select year, case when bool_and(coverage = 'future') then 'future'
      when bool_and(coverage in ('complete','future')) then 'complete'
      when bool_and(coverage in ('unavailable','future')) then 'unavailable'
      else 'partial' end as coverage,
      sum(total) as total,
      jsonb_agg(jsonb_build_object('month',month,'count',case when coverage in ('future','unavailable') then null else total end,'coverage',coverage) order by month) as months
    from months group by year
  )
  select jsonb_build_object('latestAcademicYear',latest_year,'completeFrom',tracking_start,
    'years',coalesce(jsonb_agg(jsonb_build_object('academicYear',year,'label',year::text || '–' || (year+1)::text,
      'count',case when coverage in ('future','unavailable') then null else total end,'coverage',coverage,'months',months) order by year),'[]'::jsonb))
  into result from years;
  return result;
end;
$$;

create function public.admin_major_distribution() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  with majors as (
    select coalesce(nullif(btrim(major, E' \t\r\n'),''),'Unknown') as major, count(*) as total
    from public.user_info where deleted_at is null group by 1
  )
  select jsonb_build_object('totalAccounts',coalesce(sum(total),0),
    'majors',coalesce(jsonb_agg(jsonb_build_object('major',major,'count',total) order by major),'[]'::jsonb))
  into result from majors;
  return result;
end;
$$;

revoke all on function public.lock_membership_history(), public.sync_membership_award_month(),
  public.record_membership_award(uuid,timestamptz,text), public.record_fulfilled_membership_award(),
  public.record_manual_membership_award(), public.fulfill_membership_purchase(uuid,timestamptz),
  public.rebuild_membership_history(), public.admin_membership_history(timestamptz,integer,integer), public.admin_major_distribution()
  from public, anon, authenticated;
grant execute on function public.record_membership_award(uuid,timestamptz,text),
  public.fulfill_membership_purchase(uuid,timestamptz), public.rebuild_membership_history() to service_role;
grant execute on function public.admin_membership_history(timestamptz,integer,integer), public.admin_major_distribution() to authenticated;

-- Local seed reconciliation resets only named fixture people. Normal rebuilds
-- never remove durable awards when their purchase/profile disappears.
create function public.reset_fixture_membership_history(p_person_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform pg_advisory_xact_lock(74623819001);
  delete from public.membership_awards where person_id = any(p_person_ids);
  for p in select user_id, fulfilled_at from public.purchases where user_id = any(p_person_ids)
    and kind = 'membership' and status = 'completed' and fulfilled_at is not null order by fulfilled_at, id
  loop
    perform public.record_membership_award(p.user_id, p.fulfilled_at, 'purchase');
  end loop;
end;
$$;
revoke all on function public.reset_fixture_membership_history(uuid[]) from public, anon, authenticated;
grant execute on function public.reset_fixture_membership_history(uuid[]) to service_role;
