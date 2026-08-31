# Event media and application file storage

Binary uploads are intentionally not implemented as part of the event form
rebuild. The form stores nullable media paths and file-question constraints so
the upload layer can be added without changing the content model again.

## Recommended buckets

- `event-media`: public, CDN-cacheable event covers, mentor photos, and sponsor
  logos.
- `application-files`: private applicant files. Read access should use
  short-lived signed URLs after verifying that the requester is the applicant
  or an administrator.

Store object paths in Postgres, not file bytes or permanent signed URLs. Use
immutable UUID-based paths so replacements naturally invalidate caches:

```text
events/{event_id}/covers/{asset_id}.webp
events/{event_id}/mentors/{asset_id}.webp
events/{event_id}/sponsors/{asset_id}.png
events/{event_id}/registrations/{registration_id}/questions/{question_id}/{asset_id}.pdf
```

## Upload flow

1. Send uploads to authenticated route handlers.
2. Verify admin access for public event media, or registration ownership for
   application files.
3. Enforce MIME type, byte size, and image dimensions on the server.
4. Resize and compress public photos before storing them.
5. Upload through the server-only Supabase service-role client.
6. Save the object path and metadata only after storage succeeds.
7. Delete replaced objects after the database update succeeds.

When uploads are implemented, add a `media_assets` table containing bucket,
path, purpose, owner/entity IDs, original filename, MIME type, byte size, and
uploader. This enables reliable cleanup and auditing. A scheduled orphan sweep
should remove storage objects that have no matching metadata row, while event
and registration deletion should explicitly remove their object prefixes.
