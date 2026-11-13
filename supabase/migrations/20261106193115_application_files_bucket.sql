-- Private bucket for files members attach to application answers.
--
-- Unlike event-images and profile-photos, members upload here directly with
-- their own session, so this bucket has storage.objects policies. Objects are
-- keyed <user_info_id>/<application_id>/<question_id>/<file name>, and the
-- answer to a file_upload question holds that key. submit_event_application
-- (20261106193112) checks that a file answer names an object under the right
-- prefix.
--
--   - Insert: the member, into their own draft, under a file_upload question
--     of that draft's event.
--   - Delete: the member, under their own prefix, unless the application has
--     been submitted. A deleted draft's files stay removable, so the app can
--     clean up in either order.
--   - Select: the member under their own prefix, and admins once the
--     application is submitted.
--   - No update: a replacement is a new upload, then a delete.
--
-- file_size_limit and allowed_mime_types are enforced by Storage itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-files',
  'application-files',
  false,
  5242880,
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when `p_name` is <caller>/<their draft>/<a file_upload question of its
-- event>/<file>. Compares ids as text so a malformed key is false, not an error.
create function public.can_upload_application_file(p_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.event_applications application
    join public.event_application_questions question
      on question.event_id = application.event_id
    cross join lateral (select storage.foldername(p_name) as folders) path
    where cardinality(path.folders) = 3
      and path.folders[1] = public.current_user_info_id()::text
      and application.id::text = path.folders[2]
      and question.id::text = path.folders[3]
      and application.user_id = public.current_user_info_id()
      and application.status = 'draft'
      and question.response_type = 'file_upload'
  );
$$;

-- True when the caller may remove `p_name`: it is under their own prefix and
-- its application is a draft or no longer exists.
create function public.can_remove_application_file(p_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = public.current_user_info_id()::text
    and not exists (
      select 1
      from public.event_applications application
      where application.id::text = (storage.foldername(p_name))[2]
        and application.status <> 'draft'
    );
$$;

-- True when the caller may read `p_name`: it is under their own prefix, or
-- they are an admin and its application has been submitted.
create function public.can_read_application_file(p_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = public.current_user_info_id()::text
    or (
      public.is_admin()
      and exists (
        select 1
        from public.event_applications application
        where application.id::text = (storage.foldername(p_name))[2]
          and application.user_id::text = (storage.foldername(p_name))[1]
          and application.status <> 'draft'
      )
    );
$$;

revoke all on function public.can_upload_application_file(text) from public, anon;
revoke all on function public.can_remove_application_file(text) from public, anon;
revoke all on function public.can_read_application_file(text) from public, anon;
grant execute on function public.can_upload_application_file(text) to authenticated;
grant execute on function public.can_remove_application_file(text) to authenticated;
grant execute on function public.can_read_application_file(text) to authenticated;

create policy "application files: members upload to own draft"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'application-files'
  and public.can_upload_application_file(name)
);

create policy "application files: members remove own draft files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'application-files'
  and public.can_remove_application_file(name)
);

create policy "application files: owners and admins read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'application-files'
  and public.can_read_application_file(name)
);
