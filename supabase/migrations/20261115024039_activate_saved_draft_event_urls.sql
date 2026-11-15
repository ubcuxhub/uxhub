-- A draft has one active URL. Keep the legacy readers of events.slug working
-- while the builder continues to send configured_slug. Published URLs stay locked.
alter table public.admin_event_drafts add column event_revision integer;

create function public.sync_event_page_slug()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.configured_slug is not null and
    (tg_op = 'INSERT' or old.first_published_at is null) then
    new.slug := new.configured_slug;
  end if;
  return new;
end;
$$;
create trigger sync_event_page_slug before insert or update on public.events
for each row execute function public.sync_event_page_slug();
revoke all on function public.sync_event_page_slug() from public, anon, authenticated;

-- Existing unpublished configuration becomes the canonical URL. URL claims
-- already prevent cross-event collisions; their trigger releases the old URL.
update public.events set slug = configured_slug
where first_published_at is null and configured_slug is not null
  and slug is distinct from configured_slug;

alter function public.save_admin_event_draft(uuid, uuid, jsonb, integer)
  rename to save_admin_event_draft_before_url_activation;

create function public.save_admin_event_draft(p_id uuid, p_event_id uuid, p_document jsonb, p_revision integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_event public.events;
  v_result jsonb;
  v_slug text;
  v_base text;
  v_suffix text;
  v_counter integer := 0;
  v_edited boolean;
  v_constraint text;
  v_previous public.admin_event_drafts;
begin
  -- Match the builder's mutation/draft/event lock order. Saves for different
  -- events can still race with direct writes; the URL constraints arbitrate.
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  -- Incomplete, not-yet-created events have no portal identity to rename.
  if p_event_id is null then
    return public.save_admin_event_draft_before_url_activation(p_id, p_event_id, p_document, p_revision);
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'draft' or v_event.publish_at is not null then
    raise exception 'Only unscheduled drafts can save working documents.';
  end if;
  v_edited := coalesce((p_document #>> '{formState,slug_edited}')::boolean, true);
  v_base := nullif(p_document #>> '{formState,page_slug}', '');
  if not v_edited and v_event.first_published_at is null and
    btrim(coalesce(p_document #>> '{formState,name}', '')) <> '' then
    v_base := rtrim(left(btrim(regexp_replace(lower(btrim(p_document #>> '{formState,name}')),
      '[^a-z0-9]+', '-', 'g'), '-'), 100), '-');
    if v_base = '' then v_base := 'item'; end if;
    if v_base in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings') then
      v_base := v_base || '-event';
    end if;
  end if;
  if v_base is null then
    -- Keep incomplete documents saveable without deleting an existing URL.
    v_base := v_event.slug;
  end if;
  if length(v_base) > 100 or v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or
    v_base in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings') then
    raise exception 'Use a valid, non-reserved page URL of at most 100 characters.';
  end if;
  if v_event.first_published_at is not null and v_base is distinct from v_event.slug then
    raise exception 'The page URL is locked after first publication.';
  end if;
  v_slug := v_base;
  -- Preserve an automatic suffix on repeated saves, including retries after a
  -- lost response. A genuinely changed name/URL starts allocation again.
  v_suffix := substring(v_event.slug from '-[0-9]+$');
  if not v_edited and v_suffix is not null and
    v_event.slug = rtrim(left(v_base, 100 - length(v_suffix)), '-') || v_suffix then
    v_slug := v_event.slug;
  end if;
  select * into v_previous from public.admin_event_drafts where id = p_id for update;
  if found and v_previous.event_id = p_event_id and not v_previous.materialized
    and v_previous.document = jsonb_set(p_document, '{formState,page_slug}', to_jsonb(v_slug))
    and v_previous.event_revision is not null then
    -- A response-loss retry returns the saved revision, never a later revision
    -- from an unrelated event write that the editor has not loaded.
    return to_jsonb(v_previous);
  end if;
  loop
    begin
      if (v_event.slug, v_event.configured_slug, v_event.configured_slug_edited)
        is distinct from (v_slug, v_slug, v_edited) then
        update public.events set slug = v_slug, configured_slug = v_slug,
          configured_slug_edited = v_edited
        where id = p_event_id returning * into v_event;
      end if;
      -- Canonical URL and working document commit together. A stale document
      -- or any later error rolls the URL/claims/revision back as well.
      v_result := public.save_admin_event_draft_before_url_activation(
        p_id, p_event_id,
        jsonb_set(p_document, '{formState,page_slug}', to_jsonb(v_slug)), p_revision);
      update public.admin_event_drafts set event_revision = v_event.revision
        where id = p_id returning to_jsonb(admin_event_drafts.*) into v_result;
      return v_result;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint not in ('events_slug_key', 'idx_events_slug', 'event_url_claims_pkey') then raise; end if;
        if v_edited then raise exception 'This page URL is already in use.'; end if;
      when raise_exception then
        if sqlerrm <> 'This page URL is already in use.' or v_edited then raise; end if;
    end;
    v_counter := v_counter + 1;
    v_suffix := '-' || v_counter::text;
    v_slug := rtrim(left(v_base, 100 - length(v_suffix)), '-') || v_suffix;
  end loop;
end;
$$;
revoke all on function public.save_admin_event_draft(uuid, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_admin_event_draft(uuid, uuid, jsonb, integer) to service_role;
