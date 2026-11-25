-- Purchase safety (payments audit).
--
-- 1. fail_abandoned_purchases: a purchase still pending with no Square payment
--    ID fifteen minutes after it was created never reached Square, or Square
--    refused it, so no webhook will ever settle it. Left pending, it blocked
--    the buyer from buying that membership again, and kept an event's pricing
--    and deletion locked as a payment in flight, for good. It is failed
--    instead (the app does the same when the buyer retries, with the interval
--    in ABANDONED_PURCHASE_AFTER_MS). If Square did take the payment after
--    all, its signed webhook still finds the purchase through `referenceId`
--    and records the completion. pg_cron runs it every five minutes.
-- 2. One live membership purchase per user: two checkouts from two tabs (or
--    for two tiers) both passed the app's checks and both charged the card.
--    Abandoned attempts are failed first. If live duplicates still remain,
--    the index is skipped with a warning rather than failing the deploy
--    (see create_one_live_membership_index).
--
-- Backward compatible with the deployed code: it never creates a second live
-- membership purchase except in that race, which now fails with 23505 and
-- reports a checkout error instead of a second charge.

create function public.fail_abandoned_purchases()
returns integer
language sql security definer set search_path = '' as $$
  with failed as (
    update public.purchases
    set status = 'failed',
        failure_reason = 'This payment did not go through. Please try again.'
    where status = 'pending'
      and square_payment_id is null
      and created_at < now() - interval '15 minutes'
    returning 1
  )
  select count(*)::integer from failed;
$$;

revoke all on function public.fail_abandoned_purchases() from public, anon, authenticated;
grant execute on function public.fail_abandoned_purchases() to service_role;

select public.fail_abandoned_purchases();

select cron.schedule(
  'fail-abandoned-purchases',
  '*/5 * * * *',
  'select public.fail_abandoned_purchases()'
);

-- Creates the index unless live membership purchases the cleanup above left
-- (ones with a Square payment ID) still give some user two. Production data
-- isn't visible from here, and a failed migration fails the deploy, so
-- duplicates skip the index with a warning instead: once they settle, a
-- follow-up migration calls this again. Checkout settles a live purchase
-- before charging either way; the index only closes the race between two.
-- True when the index exists afterwards.
create function public.create_one_live_membership_index()
returns boolean
language plpgsql set search_path = '' as $$
declare
  v_users integer;
begin
  if to_regclass('public.purchases_one_live_membership_per_user') is not null then
    return true;
  end if;

  select count(*)::integer into v_users
  from (
    select user_id from public.purchases
    where kind = 'membership' and status in ('pending', 'authorized')
    group by user_id
    having count(*) > 1
  ) duplicated;

  if v_users > 0 then
    raise warning '% user(s) have more than one live membership purchase, so purchases_one_live_membership_per_user was not created. Settle them, then create it in a follow-up migration with select public.create_one_live_membership_index().', v_users;
    return false;
  end if;

  create unique index purchases_one_live_membership_per_user
    on public.purchases (user_id)
    where kind = 'membership' and status in ('pending', 'authorized');
  return true;
end;
$$;

revoke all on function public.create_one_live_membership_index() from public, anon, authenticated;

select public.create_one_live_membership_index();
