-- A deleted account frees its team spots.
--
-- delete_account anonymizes user_info and keeps the row, so team_members'
-- cascade never fires. This runs when deleted_at is first set, as the audit
-- log's triggers detect a deletion, so it holds whatever delete_account's body
-- becomes. Their tickets stay, as before.
--
-- A team they owned passes to the teammate who joined first, who can then
-- manage it; one with nobody else on it is deleted.

create function public.free_team_spots_of_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.teams team
  where team.owner_id = new.id
    and not exists (
      select 1
      from public.team_members member
      where member.team_id = team.id
        and member.user_id <> new.id
    );

  update public.teams team
  set owner_id = (
    select member.user_id
    from public.team_members member
    where member.team_id = team.id
      and member.user_id <> new.id
    order by member.joined_at, member.user_id
    limit 1
  )
  where team.owner_id = new.id;

  delete from public.team_members
  where user_id = new.id;

  return null;
end;
$$;

revoke all on function public.free_team_spots_of_deleted_user() from public, anon, authenticated;

create trigger free_team_spots_on_account_deletion
  after update of deleted_at on public.user_info
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.free_team_spots_of_deleted_user();
