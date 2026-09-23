# Event media and application file storage

Event cover uploads are built. Mentor photos, sponsor logos, and applicant files
are not yet: the event form stores nullable media paths
(`mentors.profile_image_path`, `sponsors.brand_logo_path`) and file-question
constraints so the upload layer can be added without changing the content model
again. This doc describes what exists and how the rest should be built on top of
it.

## What exists: event covers

- **Bucket:** the public `event-images` bucket, named in
  [`buckets.ts`](../src/lib/supabase-helpers/buckets.ts). How it is provisioned
  and why it has no `storage.objects` policies is covered under
  [Storage in `supabase/README.md`](../supabase/README.md#storage).
- **Upload:** admins post to `/api/upload-event-image`, which checks
  `requireAdmin()`, enforces MIME type, byte size (4 MB), and image dimensions
  on the server ([`event-image.ts`](../src/lib/event-image.ts)), and uploads
  through the service-role client.
- **Keys:** `covers/<slug>-<uuid>.<ext>`. Each upload gets a fresh key, so the
  long `cache-control` never serves a stale image after a replacement.
- **Stored value:** `events.image_url` holds the public URL, not the object
  path. When a cover is replaced or its event deleted, the admin actions parse
  the key back out of the URL and remove the object, best-effort.
- **Not done:** covers are not resized or recompressed, and there is no
  `media_assets` table or orphan sweep.

## Public media still to build: mentor photos and sponsor logos

Put them in the same `event-images` bucket rather than a new one. It is already
public, CDN-cached, and provisioned in every environment. Follow the cover
conventions, with one prefix per kind:

```text
mentors/<name>-<uuid>.<ext>
sponsors/<name>-<uuid>.<ext>
```

Despite their names, the `*_path` columns hold URLs today: legacy mentor data
was migrated in as external image URLs, and `/events/[slug]` renders the column
straight into `<img src>`. Store the public URL there, as covers do, unless you
also change the page to build URLs from object paths.

## Applicant files: a separate private bucket

Applicant uploads must not share the public bucket. Use a private
`application-files` bucket and serve reads through short-lived signed URLs, issued
only after checking that the requester is the applicant or an administrator.
Key objects under the registration they belong to:

```text
registrations/{registration_id}/questions/{question_id}/{uuid}.pdf
```

## Upload flow for new media

1. Send uploads to authenticated route handlers.
2. Verify admin access for public event media, or registration ownership for
   application files.
3. Enforce MIME type, byte size, and image dimensions on the server.
4. Resize and compress public photos before storing them.
5. Upload through the server-only Supabase service-role client.
6. Save the object path and metadata only after storage succeeds.
7. Delete replaced objects after the database update succeeds.

## Cleanup and auditing

Once more than covers are uploaded, add a `media_assets` table containing bucket,
path, purpose, owner/entity IDs, original filename, MIME type, byte size, and
uploader. A scheduled orphan sweep should remove storage objects that have no
matching metadata row, and deleting an event or registration should explicitly
remove the objects it owns.
