create type public.student_status as enum (
  'undergraduate',
  'graduate',
  'other'
);

alter table public.user_info
  add column faculty_email text,
  add column school_institution text,
  add column student_status public.student_status;

comment on column public.user_info.faculty_email is
  'UBC faculty email supplied for faculty membership eligibility';
comment on column public.user_info.school_institution is
  'School or institution supplied by Non-UBC users';
comment on column public.user_info.student_status is
  'Study level supplied by Non-UBC users';
