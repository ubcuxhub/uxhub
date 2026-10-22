alter table public.user_info add column profile_photo_path text;
alter table public.user_info add constraint user_info_profile_photo_path_owned
  check (profile_photo_path is null or profile_photo_path ~ ('^profiles/' || id::text || '/[0-9a-f-]+\.(jpg|png)$'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 4194304, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Public reads; writes remain server-only, just like event-images.

-- Also runs during delete_account's existing anonymization update.
create function public.scrub_user_profile_photos() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null then
    new.profile_photo_path := null;
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_user_profile_photos() from public, anon, authenticated;
create trigger scrub_user_profile_photos before update on public.user_info
for each row execute function public.scrub_user_profile_photos();
-- New columns intentionally have no authenticated UPDATE grant yet.
