alter table public.events
add column slug text;

alter table public.membership_types
add column slug text;

with ranked_events as (
  select
    id,
    case
      when slug_rank = 1 then base_slug
      else base_slug || '-' || (slug_rank - 1)::text
    end as slug
  from (
    select
      id,
      coalesce(
        nullif(
          trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
          ''
        ),
        'event'
      ) as base_slug,
      row_number() over (
        partition by coalesce(
          nullif(
            trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
            ''
          ),
          'event'
        )
        order by created_at, id
      ) as slug_rank
    from public.events
  ) ranked
)
update public.events
set slug = ranked_events.slug
from ranked_events
where public.events.id = ranked_events.id;

with ranked_membership_types as (
  select
    id,
    case
      when slug_rank = 1 then base_slug
      else base_slug || '-' || (slug_rank - 1)::text
    end as slug
  from (
    select
      id,
      case
        when lower(name) like '%innovator%' then 'innovator'
        when lower(name) like '%explorer%' then 'explorer'
        when lower(name) like '%faculty%' then 'faculty'
        when lower(name) like '%non%' then 'non-ubc'
        else coalesce(
          nullif(
            trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
            ''
          ),
          'membership'
        )
      end as base_slug,
      row_number() over (
        partition by case
          when lower(name) like '%innovator%' then 'innovator'
          when lower(name) like '%explorer%' then 'explorer'
          when lower(name) like '%faculty%' then 'faculty'
          when lower(name) like '%non%' then 'non-ubc'
          else coalesce(
            nullif(
              trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
              ''
            ),
            'membership'
          )
        end
        order by created_at, id
      ) as slug_rank
    from public.membership_types
  ) ranked
)
update public.membership_types
set slug = ranked_membership_types.slug
from ranked_membership_types
where public.membership_types.id = ranked_membership_types.id;

alter table public.events
alter column slug set not null;

alter table public.membership_types
alter column slug set not null;

alter table public.events
add constraint events_slug_key unique (slug);

alter table public.membership_types
add constraint membership_types_slug_key unique (slug);
