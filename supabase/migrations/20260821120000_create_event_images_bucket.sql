-- Public bucket for admin-uploaded event cover images.
--
-- Uploads go through the service-role client (src/lib/supabase/admin.ts), which
-- bypasses RLS entirely. Public reads are served by
-- /storage/v1/object/public/event-images/... without an RLS check because the
-- bucket is public. storage.objects ships default-deny for anon and
-- authenticated, which is exactly the desired posture, so this migration
-- intentionally creates no storage.objects policies -- adding them would only
-- widen the surface.
--
-- file_size_limit and allowed_mime_types are defense in depth: the route and
-- the client both validate first (see src/lib/event-image.ts), and Storage
-- rejects anything that slips past them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  4194304,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
