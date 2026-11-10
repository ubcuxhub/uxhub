-- Reviewer notes: a comment thread admins keep on an application while they
-- review it (docs/design/application-review.md §5 and §6).
--
--   - Admins and managers (is_admin()) read every note on a submitted
--     application. Drafts are the applicant's alone, so a note on one can be
--     neither read nor written.
--   - An admin writes notes as themselves, and edits or deletes only their
--     own. A demoted admin keeps authorship but loses access; their notes stay
--     for everyone else, under their name.
--   - Applicants never see notes, not even on their own application.
--   - author_id is a user_info id, not an Auth user id, so ownership compares
--     with current_user_info_id(), never auth.uid().
--   - Accounts are anonymised rather than deleted (delete_account), so the
--     author reference holds and the note stays, shown as "Deleted user".
--   - Hard delete: the UI says a deleted note can't be brought back.
--
-- A new table only, so it is backward compatible with the code in production.

set search_path = '';

create table public.application_review_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.event_applications (id) on delete cascade,
  -- Defaults to the signed-in member, so a client can't forget it; the insert
  -- policy holds an explicit value to the same.
  author_id uuid not null default public.current_user_info_id()
    references public.user_info (id),
  -- Plain text with its line breaks. NOTE_MAX_LENGTH in ReviewerNotes.tsx.
  body text not null
    constraint application_review_notes_body_length
    check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  -- Set when an update changes the body; drives "Edited".
  edited_at timestamptz
    constraint application_review_notes_edited_after_created
    check (edited_at is null or edited_at >= created_at)
);

comment on table public.application_review_notes is
  'Reviewer notes: admins'' comment thread on a submitted application. Only admins read them; each admin edits and deletes only their own.';

-- The thread reads one application's notes oldest first, and the review list
-- counts them per application.
create index application_review_notes_application_created_idx
  on public.application_review_notes (application_id, created_at);

-- Lets a profile's notes be found quickly, e.g. by the seed's prune.
create index application_review_notes_author_idx
  on public.application_review_notes (author_id);

-- ── Edits ───────────────────────────────────────────────────────────────────
--
-- A note stays on its application, with its author and its time. edited_at
-- moves only when the body really changes, so saving an unchanged note leaves
-- it unedited, and nobody sets edited_at by hand on an update.

create function public.guard_application_review_note_update()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.application_id is distinct from old.application_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only a reviewer note''s text can change.'
      using errcode = 'check_violation';
  end if;

  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_application_review_note_update()
  from public, anon, authenticated;

create trigger guard_application_review_note_update
before update on public.application_review_notes
for each row execute function public.guard_application_review_note_update();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.application_review_notes enable row level security;

-- The draft check reads event_applications under the caller's own policies;
-- the explicit status test also covers an admin reading their own draft
-- through "applications: read own".
create policy "review notes: admins read on submitted applications"
on public.application_review_notes
for select
to authenticated
using (
  public.is_admin()
  and exists (
    select 1
    from public.event_applications application
    where application.id = application_review_notes.application_id
      and application.status <> 'draft'
  )
);

create policy "review notes: admins add their own"
on public.application_review_notes
for insert
to authenticated
with check (
  public.is_admin()
  and author_id = public.current_user_info_id()
  and exists (
    select 1
    from public.event_applications application
    where application.id = application_review_notes.application_id
      and application.status <> 'draft'
  )
);

create policy "review notes: admins edit their own"
on public.application_review_notes
for update
to authenticated
using (public.is_admin() and author_id = public.current_user_info_id())
with check (public.is_admin() and author_id = public.current_user_info_id());

create policy "review notes: admins delete their own"
on public.application_review_notes
for delete
to authenticated
using (public.is_admin() and author_id = public.current_user_info_id());

-- Supabase grants every privilege on new public tables by default. Take them
-- back, then give the signed-in role only what the policies filter: it names
-- the application, author and text of a new note, and changes only the text.
revoke all on public.application_review_notes from anon, authenticated;
grant select, delete on public.application_review_notes to authenticated;
grant insert (application_id, author_id, body)
  on public.application_review_notes to authenticated;
grant update (body) on public.application_review_notes to authenticated;
grant all on public.application_review_notes to service_role;
