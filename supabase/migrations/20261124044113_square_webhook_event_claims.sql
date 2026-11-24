-- Square webhook events: claims, not payloads (payments audit).
--
-- 1. Every signed delivery's whole payload was kept forever, including sales
--    at the same Square location that have nothing to do with the app, with
--    the buyer's email, postal code and card details. Dedupe needs only the
--    event ID, so the app stops writing `payload`, keeps the payment ID it
--    concerns in `square_payment_id` (what the payment smoke test looks up),
--    and the stored payloads are cleared.
-- 2. `processed_at` now means what it says. The app claims an event with
--    `processed_at` null and stamps it once handling succeeds, so a duplicate
--    delivery that arrives while the first is still running is asked to come
--    back later instead of being acknowledged and lost. Rows written before
--    this (and by the deployed code, which leaves the column to its default)
--    count as processed, as they always did.
--
-- Backward compatible: `payload` becomes nullable and the new column is
-- optional, so the deployed code's inserts still work.

alter table public.square_webhook_events
  alter column payload drop not null,
  add column square_payment_id text;

update public.square_webhook_events
set square_payment_id = coalesce(
      payload #>> '{data,object,payment,id}',
      payload #>> '{data,object,refund,payment_id}'
    ),
    payload = null;

create index square_webhook_events_square_payment_id
  on public.square_webhook_events (square_payment_id)
  where square_payment_id is not null;
