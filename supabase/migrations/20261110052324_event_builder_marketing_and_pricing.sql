-- Form-first configuration. Existing readers keep using their effective fields
-- until the deferred marketing/pricing/fulfillment integration is delivered.
alter table public.events
  add column configured_marketing_mode text check (configured_marketing_mode in ('disabled', 'hosted', 'external')),
  add column configured_marketing_url text,
  add column configured_slug text,
  add column configured_pricing_mode text check (configured_pricing_mode in ('free', 'paid')),
  add column configured_price numeric,
  add column pricing_policy text not null default 'legacy' check (pricing_policy in ('legacy', 'figma_pending')),
  add column first_published_at timestamptz,
  add constraint events_configured_price check (
    (configured_pricing_mode is null and configured_price is null) or
    (configured_pricing_mode is not null and configured_price is not null and
     configured_price >= 0 and configured_price < 1000000 and
     configured_price = round(configured_price, 2) and
     (configured_pricing_mode <> 'free' or configured_price = 0))),
  add constraint events_configured_external_url check (
    configured_marketing_mode is distinct from 'external' or
    configured_marketing_url ~* '^https?://[^[:space:]/?#@]+(:[0-9]+)?([/?#][^[:space:]]*)?$');

update public.events set first_published_at = coalesce(updated_at, created_at, now()) where status <> 'draft';

-- One URL namespace for current event identities and future hosted settings.
-- A claims table makes checks race-safe, including slug/config cross-collisions.
create table public.event_url_claims (
  slug text primary key,
  event_id uuid not null references public.events(id) on delete cascade
);
alter table public.event_url_claims enable row level security;
revoke all on public.event_url_claims from anon, authenticated;
grant all on public.event_url_claims to service_role;
insert into public.event_url_claims select slug, id from public.events where slug is not null;

create function public.admin_event_pricing_locked(p_event_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then raise exception 'Staff access required.'; end if;
  return exists(select 1 from public.event_tickets where event_id = p_event_id)
    or exists(select 1 from public.event_applications where event_id = p_event_id and status = 'accepted' and offer_expires_at > now())
    or exists(select 1 from public.purchases where event_id = p_event_id and status <> 'failed');
end;
$$;
revoke all on function public.admin_event_pricing_locked(uuid) from public, anon;
grant execute on function public.admin_event_pricing_locked(uuid) to authenticated, service_role;

create function public.guard_event_builder_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- New callers declare configured pricing; old deployments/inserts retain
    -- their legacy default. New-policy checkout cannot accidentally go live.
    if new.configured_pricing_mode is not null then new.pricing_policy := 'figma_pending'; end if;
  else
    if new.pricing_policy is distinct from old.pricing_policy then
      raise exception 'Pricing activation requires the pricing integration.';
    end if;
    if old.first_published_at is not null and
      (new.slug is distinct from old.slug or new.configured_slug is distinct from old.configured_slug) then
      -- Initializing the saved configuration with the existing URL is safe.
      if not (old.configured_slug is null and new.configured_slug = old.slug and new.slug is not distinct from old.slug) then
        raise exception 'The page URL is locked after first publication.';
      end if;
    end if;
    new.first_published_at := old.first_published_at;
    if (new.regular_price, new.member_price, new.configured_pricing_mode, new.configured_price)
      is distinct from (old.regular_price, old.member_price, old.configured_pricing_mode, old.configured_price)
      and public.admin_event_pricing_locked(old.id) then
      raise exception 'Pricing is locked because registrations or payments exist.';
    end if;
  end if;
  if new.pricing_policy = 'figma_pending' and (new.status <> 'draft' or new.publish_at is not null) then
    raise exception 'New pricing is saved as a draft. Publication requires the pricing and free-registration integration.';
  end if;
  if new.status <> 'draft' and new.first_published_at is null then new.first_published_at := now(); end if;
  if new.configured_slug is not null and
    (length(new.configured_slug) > 100 or new.configured_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or
     new.configured_slug in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings')) then
    raise exception 'Use a valid, non-reserved page URL of at most 100 characters.';
  end if;
  return new;
end;
$$;
create trigger guard_event_builder_settings before insert or update on public.events
for each row execute function public.guard_event_builder_settings();

create function public.claim_event_urls()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.event_url_claims where event_id = new.id and slug is distinct from new.slug and slug is distinct from new.configured_slug;
  insert into public.event_url_claims(slug, event_id)
    select distinct candidate, new.id from unnest(array[new.slug, new.configured_slug]) candidate where candidate is not null
    on conflict(slug) do update set event_id = excluded.event_id where public.event_url_claims.event_id = excluded.event_id;
  if exists(select 1 from public.event_url_claims where slug in (new.slug, new.configured_slug) and event_id <> new.id) then
    raise exception 'This page URL is already in use.';
  end if;
  return new;
end;
$$;
create trigger claim_event_urls after insert or update of slug, configured_slug on public.events
for each row execute function public.claim_event_urls();

-- Use the same event lock as reservation. A payment in flight locks pricing
-- before its amount can become a historical purchase. Direct ticket writes
-- obey the same boundary; pending policy events cannot use old fulfillment.
create function public.guard_event_checkout_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_policy text;
begin
  if new.event_id is null then return new; end if;
  select pricing_policy into v_policy from public.events where id = new.event_id for update;
  if v_policy = 'figma_pending' then
    raise exception 'Registration requires the pricing and free-registration integration.';
  end if;
  return new;
end;
$$;
create trigger guard_event_purchase_configuration before insert or update of event_id on public.purchases
for each row execute function public.guard_event_checkout_configuration();
create trigger guard_event_ticket_configuration before insert or update of event_id on public.event_tickets
for each row execute function public.guard_event_checkout_configuration();

revoke all on function public.guard_event_builder_settings(), public.claim_event_urls(), public.guard_event_checkout_configuration() from public, anon, authenticated;
