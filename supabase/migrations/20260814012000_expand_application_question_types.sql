create type public.response_type_v2 as enum (
  'short_text',
  'long_text',
  'checkbox',
  'multiple_choice',
  'dropdown',
  'file_upload'
);

alter table public.event_application_questions
  alter column response_type type public.response_type_v2
  using (
    case response_type::text
      when 'text' then
        case
          when max_char_limit is not null and max_char_limit <= 255
            then 'short_text'
          else 'long_text'
        end
      when 'single_select' then 'multiple_choice'
      when 'multi_select' then 'checkbox'
    end
  )::public.response_type_v2;

drop type public.response_type;
alter type public.response_type_v2 rename to response_type;

alter table public.event_application_questions
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists restrict_file_types boolean not null default false,
  add column if not exists allowed_file_types text[],
  add column if not exists max_file_size_bytes bigint;

with ordered_questions as (
  select
    id,
    row_number() over (
      partition by event_id
      order by created_at, id
    ) - 1 as position
  from public.event_application_questions
)
update public.event_application_questions question
set sort_order = ordered.position
from ordered_questions ordered
where ordered.id = question.id;

alter table public.event_application_questions
  add constraint event_application_questions_sort_order_check
    check (sort_order >= 0),
  add constraint event_application_questions_file_size_check
    check (max_file_size_bytes is null or max_file_size_bytes > 0);

create index idx_event_application_questions_event_sort
  on public.event_application_questions(event_id, sort_order);
