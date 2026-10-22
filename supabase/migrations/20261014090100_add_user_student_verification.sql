alter table public.user_info
  add column student_verified_at timestamptz,
  add column student_verified_by uuid references public.user_info(id) on delete set null;
alter table public.user_info add constraint user_info_verification_timestamp
  check (student_verified_at is not null or student_verified_by is null);

-- Also runs during delete_account's existing anonymization update.
create function public.scrub_user_student_verification() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null or new.student_number is distinct from old.student_number or new.user_type is distinct from old.user_type then
    new.student_verified_at := null; new.student_verified_by := null;
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_user_student_verification() from public, anon, authenticated;
create trigger scrub_user_student_verification before update on public.user_info
for each row execute function public.scrub_user_student_verification();
-- New columns intentionally have no authenticated UPDATE grant yet.
