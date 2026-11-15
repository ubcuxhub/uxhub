# Unified event lifecycle rollout

The migration and current application implement unified storage. Do not push
the migration until the deployment being retired accepts materialized legacy
draft routes. Its original draft route rejects any `draft.event_id`; the new
compatible save wrapper correctly sets that ID on first Save draft.

1. Merge [ubcuxhub/uxhub#270](https://github.com/ubcuxhub/uxhub/pull/270) and
   let it deploy first, on its own. It redirects a legacy draft that has an
   event ID to that event's existing editor and keeps the standalone-draft
   renderer. It uses only existing columns.
2. Verify that compatibility deployment is serving traffic. Apply the expand
   migration; manual slug conflicts abort with the saved draft ID. Resolve
   those saved manual URLs with their owner and retry; never delete documents
   to unblock the migration. Automatic conflicts are numbered. Backfill preserves
   standalone IDs, attached event IDs, documents, images, revisions and aliases.
3. Switch to this application's unified reads/writes. Run the local migration
   preservation script, RLS and integration checks before release. The old
   deployment remains writable through compatible RPC signatures and mirrors;
   an already-open legacy editor may need to reload its revision after backfill.
4. After all old deployments and pending retries retire, remove the legacy table
   and obsolete wrappers in a separately reviewed contract migration. Keep
   `legacy_draft_ids` redirects and operation receipts. No contraction or
   production deployment is performed by BUG-001.

The repository's Vercel build applies migrations before switching application
traffic, so #270 must be merged and serving traffic before this change merges.
An app rollback after step 2 must target the compatibility release, not the
earlier route implementation.
