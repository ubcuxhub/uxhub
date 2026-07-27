alter table public.membership_types
  add column eligible_user_types public.user_type[] not null default '{}';

update public.membership_types
set eligible_user_types = array['ubcStudent']::public.user_type[]
where slug in ('explorer', 'innovator');

update public.membership_types
set eligible_user_types = array['faculty']::public.user_type[]
where slug = 'faculty';

update public.membership_types
set eligible_user_types = array['nonUbc']::public.user_type[]
where slug = 'non-ubc';
