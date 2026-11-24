-- Raises the short overview limit from 50 to 120 characters, to match the
-- builder (src/features/admin/lib/event-overview.ts). `length()` counts code
-- points, as the app does, so an emoji is one character.
--
-- Only the limit changes; the rest is guard_event_publication_readiness as
-- 20261115024039_unify_event_draft_lifecycle.sql defined it. The old code in
-- production keeps working: it enforces 50, which is within 120.
CREATE OR REPLACE FUNCTION public.guard_event_publication_readiness()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status='active' or new.publish_at is not null then
    if new.working_document is not null then raise exception 'Finish the event in Edit before publishing.' using hint='EVENT_PUBLICATION_INVALID'; end if;
    if length(new.short_description)>120 or length(new.description)>3000 or btrim(new.name)='' or nullif(btrim(new.short_description),'') is null or
      (coalesce(new.configured_marketing_mode,'hosted')<>'disabled' and nullif(btrim(new.description),'') is null)
      or new.starts_at is null or new.ends_at is null or new.ends_at<=new.starts_at
      or new.max_capacity is null or new.regular_price is null or new.member_price is null then
      raise exception 'Finish the event in Edit before publishing.' using hint='EVENT_PUBLICATION_INVALID';
    end if;
  end if;
  return new;
end $function$;

revoke all on function public.guard_event_publication_readiness() from public, anon, authenticated;
