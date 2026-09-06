-- One UBC student number, one profile.
--
-- This does not establish student status — any eight digits still pass the
-- format check in `src/features/memberships/lib/validation.ts`. What it removes
-- is the cheapest abuse of that weakness: one real student number backing an
-- unlimited number of discounted memberships.
--
-- The index is partial to keep it off the many rows that legitimately have no
-- student number — faculty and non-UBC members never set one, and
-- `delete_account` nulls it, which also releases the number so the same person
-- can reuse it after signing up again. Postgres already treats NULLs as
-- distinct in a unique index, so the predicate is a size optimization, not what
-- makes the multiple-NULL case legal.

-- Fail loudly and specifically. Without this the migration would abort on the
-- index build with a message naming a single offending row, which says nothing
-- about how much data needs reconciling first.
do $$
declare
  v_duplicates text;
begin
  select string_agg(student_number::text, ', ' order by student_number)
  into v_duplicates
  from (
    select student_number
    from public.user_info
    where student_number is not null
    group by student_number
    having count(*) > 1
  ) as duplicated;

  if v_duplicates is not null then
    raise exception
      'Cannot enforce unique student numbers. These are on more than one profile: %. Reconcile those rows, then re-apply this migration.',
      v_duplicates;
  end if;
end;
$$;

create unique index if not exists idx_user_info_student_number
  on public.user_info (student_number)
  where student_number is not null;
