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

## Locked settings in pending drafts

Before this release staff could register for unscheduled drafts, so a pending
legacy document can disagree with a setting its event has since locked. The
first production push stopped on one:

```
Draft migration blocked for 870cca70-…: Pricing is locked because registrations or payments exist.
```

The backfill now lets the save's own guards decide. When one rejects a locked
setting of an attached draft, that setting alone is reset to the event's
current value in the document and the save is retried:

| Guard message | Document fields reset |
| --- | --- |
| Pricing is locked because registrations or payments exist. | `pricing_mode`, `pricing_amount`, `regular_price`, `member_price` |
| Registration mode is locked because registrations or payments exist. | `requires_application` |
| Capacity cannot be below N committed seats | `max_capacity` |
| Teams cannot be turned off because teams already exist. | `teams_enabled` |
| Maximum team size cannot be below N | `max_team_size` |
| The page URL is locked after first publication (or an invalid URL on a once-published event) | `page_slug` |

Every other pending edit is kept, and the runtime locks still reject ordinary
saves. Each reset raises a `WARNING` naming the draft, the event and the
settings, never their values. `supabase db push` (CLI 2.122) prints neither
notices nor warnings, so read them in the Supabase dashboard's Postgres logs.
Anything else still stops the push with the draft ID.

### Preflight

Run this read-only query against production before redeploying. Each row is a
pending draft that would still stop the backfill; an empty result means none
of these checks would. It shows IDs and booleans only.

```sql
with pending as (
  select d.id draft_id, d.event_id, d.updated_at, d.document, d.document->'formState' s,
    e.status, e.publish_at, e.first_published_at, e.slug event_slug, e.configured_slug, e.configured_slug_edited,
    -- The save fills an unconfigured document's URL from its event.
    (jsonb_typeof(d.document->'formState') = 'object' and (not (d.document->'formState' ? 'pricing_mode')
      or d.document #>> '{formState,configuration_initialized}' = 'false')) inherits
  from public.admin_event_drafts d left join public.events e on e.id = d.event_id
  where not d.materialized
), url as (
  select p.*, coalesce(p.event_id, p.draft_id) target_id,
    case when p.inherits then coalesce(p.configured_slug, p.event_slug, p.s->>'page_slug', '') else p.s->>'page_slug' end page_slug,
    case when p.inherits and p.configured_slug_edited is not null then p.configured_slug_edited
      else coalesce(p.s->>'slug_edited', 'true') <> 'false' end slug_edited
  from pending p
), checks as (
  select u.draft_id, u.event_id, u.updated_at,
    (u.event_id is not null and (u.status <> 'draft' or u.publish_at is not null)) attached_to_published_or_scheduled,
    (u.document->>'version' is distinct from '1' or jsonb_typeof(u.s) is distinct from 'object') invalid_document,
    (u.first_published_at is null and u.slug_edited and nullif(u.page_slug, '') is not null and (length(u.page_slug) > 100
      or u.page_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or u.page_slug in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings'))) invalid_manual_url,
    (u.first_published_at is null and u.slug_edited and nullif(u.page_slug, '') is not null and (
      exists(select 1 from public.event_url_claims c where c.slug = u.page_slug and c.event_id <> u.target_id)
      or exists(select 1 from public.events x where x.slug = u.page_slug and x.id <> u.target_id)
      or exists(select 1 from url o where o.draft_id <> u.draft_id and o.first_published_at is null and o.slug_edited
        and o.page_slug = u.page_slug and (o.updated_at, o.draft_id) < (u.updated_at, u.draft_id)))) manual_url_in_use,
    -- A once-published event whose saved configuration names another URL
    -- cannot be reconciled to its locked URL.
    (u.first_published_at is not null and u.configured_slug is distinct from null
      and u.configured_slug <> u.event_slug) published_url_unresolvable,
    -- Values the save casts; the builder writes JSON booleans and enum labels.
    (exists(select 1 from unnest(array['slug_edited','is_featured','teams_enabled','requires_application',
        'mentors_enabled','sponsors_enabled','agenda_enabled']) k
      where jsonb_typeof(u.s->k) not in ('boolean', 'null') and lower(u.s->>k) not in ('true', 'false'))
      or (u.s->>'event_type' is not null and u.s->>'event_type' not in (select enumlabel from pg_enum where enumtypid = 'public.event_type'::regtype))
      or (u.s #>> '{date_location,location,type}' is not null and u.s #>> '{date_location,location,type}'
        not in (select enumlabel from pg_enum where enumtypid = 'public.event_location_type'::regtype))) invalid_field_values
  from url u
)
select draft_id, event_id, attached_to_published_or_scheduled, invalid_document, invalid_manual_url,
  manual_url_in_use, published_url_unresolvable, invalid_field_values
from checks
where attached_to_published_or_scheduled or invalid_document or invalid_manual_url
  or manual_url_in_use or published_url_unresolvable or invalid_field_values
order by updated_at, draft_id;
```

Resolve each row with the draft's owner, as in step 2: publish or discard the
pending edits through the deployed builder, or fix the saved URL. Never delete
a document to unblock the migration. The query does not re-run the content
validator (people and resources): the legacy table validated each document's
content on write, under rules at least as strict as the save's.
