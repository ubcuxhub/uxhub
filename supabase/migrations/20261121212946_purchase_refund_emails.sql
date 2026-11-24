-- Refund emails (docs/event-states.md, "Refunds").
--
-- The buyer gets one email per completed Square refund. `purchases` records
-- only the refunded total, and a purchase can take several partial refunds,
-- so the send is tracked per refund here, keyed by Square's refund ID. The
-- webhook can see the same refund many times (retries, `payment.updated` and
-- `refund.*` for the same refund, concurrent deliveries):
--   * the row is inserted once (the primary key absorbs the rest);
--   * a send first claims the row by setting `email_attempted_at` where it is
--     still null, which only one caller can win;
--   * a failed send clears the claim again so a later delivery retries;
--   * `email_sent_at` marks it done.
--
-- Service role only: no policies, and nothing granted to clients.
--
-- Additive: a new table, nothing the deployed code reads changes.

create table public.purchase_refund_emails (
  square_refund_id   text        primary key,
  purchase_id        uuid        not null references public.purchases (id) on delete cascade,
  -- This refund's amount, not the purchase's running total.
  amount_cents       integer     not null check (amount_cents > 0),
  currency           text        not null,
  email_attempted_at timestamptz,
  email_sent_at      timestamptz,
  created_at         timestamptz not null default now()
);

create index purchase_refund_emails_purchase_id_idx
  on public.purchase_refund_emails (purchase_id);

alter table public.purchase_refund_emails enable row level security;

revoke all on table public.purchase_refund_emails from public, anon, authenticated;
grant all on table public.purchase_refund_emails to service_role;
