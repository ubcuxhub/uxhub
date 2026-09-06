-- These are ordinary profile details owned by non-UBC users, alongside year.
-- They were added before the safe-update column grant and were omitted from it.
grant update (school_institution, student_status)
  on public.user_info
  to authenticated;
