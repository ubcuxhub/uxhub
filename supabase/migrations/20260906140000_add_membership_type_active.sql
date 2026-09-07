alter table public.membership_types
add column active boolean not null default true;

comment on column public.membership_types.active is
  'Whether this membership tier can be offered or assigned. Inactive rows remain available to historical purchases and memberships.';
