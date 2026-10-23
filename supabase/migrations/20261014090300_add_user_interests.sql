alter table public.user_info add column interests text[] not null default '{}';
create function public.valid_user_interests(tags text[]) returns boolean
language sql immutable set search_path = public as $$
  select cardinality(tags) <= 20
    and (cardinality(tags) = 0 or array_ndims(tags) = 1)
    and not exists (select 1 from unnest(tags) t where t is null or length(btrim(t)) = 0 or length(t) > 50 or t <> btrim(t))
    and cardinality(tags) = (select count(distinct lower(t)) from unnest(tags) t);
$$;
alter table public.user_info add constraint user_info_valid_interests check (public.valid_user_interests(interests));

-- Also runs during delete_account's existing anonymization update.
create function public.scrub_user_interests() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null then
    new.interests := '{}';
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_user_interests() from public, anon, authenticated;
create trigger scrub_user_interests before update on public.user_info
for each row execute function public.scrub_user_interests();
-- New columns intentionally have no authenticated UPDATE grant yet.
