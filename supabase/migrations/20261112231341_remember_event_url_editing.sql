-- Keep the name-following/custom distinction across full event saves too.
-- Legacy event URLs remain fixed; new forms explicitly send false while the
-- administrator has not deliberately edited the suggested URL.
alter table public.events add column configured_slug_edited boolean not null default true;
