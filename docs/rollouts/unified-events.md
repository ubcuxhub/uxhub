# Unified event lifecycle rollout

The migration and current application implement unified storage. Do not push
the migrations until the deployment being retired accepts materialized legacy
draft routes. Its original draft route rejects any `draft.event_id`; the new
compatible save wrapper correctly sets that ID on first Save draft.

1. Apply [the compatibility patch](unified-events-legacy-route.patch) to the
   retiring codebase and deploy that small release first, without the unified
   migrations/new application changes. It redirects a legacy draft that has an
   event ID to that event's existing editor, while preserving the original
   standalone-draft renderer before the migration. It uses only existing columns.
   The patch is generated against the current branch's original HEAD; inspect
   and adapt it if the deployed baseline differs.
2. Verify that compatibility deployment is serving traffic. Apply the expand
   migrations; manual slug conflicts abort with the saved draft ID. Resolve
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
traffic, so step 1 is a prerequisite for deploying this full change. An app
rollback after step 2 must target the compatibility release, not the earlier
route implementation.
