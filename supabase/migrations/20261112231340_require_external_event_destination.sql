-- CHECK constraints accept NULL unless it is explicitly rejected. A selected
-- external destination needs a real URL even when a caller bypasses the form.
alter table public.events drop constraint events_configured_external_url;
alter table public.events add constraint events_configured_external_url check (
  configured_marketing_mode is distinct from 'external' or
  (configured_marketing_url is not null and
   length(configured_marketing_url) <= 2048 and
   configured_marketing_url !~ E'\\\\' and
   configured_marketing_url ~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$')
);
