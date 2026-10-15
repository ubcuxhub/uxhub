alter table public.user_info add column birth_date date;
alter table public.user_info add constraint user_info_birth_date_not_future
  check (birth_date is null or birth_date <= current_date);

-- Also runs during delete_account's existing anonymization update.
create function public.scrub_user_birthdays() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null then
    new.birth_date := null;
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_user_birthdays() from public, anon, authenticated;
create trigger scrub_user_birthdays before update on public.user_info
for each row execute function public.scrub_user_birthdays();
-- New columns intentionally have no authenticated UPDATE grant yet.
