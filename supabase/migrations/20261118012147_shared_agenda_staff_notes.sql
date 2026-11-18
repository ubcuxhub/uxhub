-- Notes are independent of participant descriptions and builder revisions.
create table public.event_agenda_notes (
  item_id uuid primary key references public.event_agenda_items(id) on delete cascade,
  body text not null default '',
  revision integer not null default 0 check (revision >= 0)
);
alter table public.event_agenda_notes enable row level security;
revoke all on public.event_agenda_notes from anon, authenticated;
grant select on public.event_agenda_notes to authenticated;
grant all on public.event_agenda_notes to service_role;
create policy "staff read agenda notes" on public.event_agenda_notes
  for select to authenticated using (public.is_admin());

-- All browser writes go through this checked seam. Even staff cannot bypass
-- the revision check with a direct update/upsert/delete.
create function public.save_agenda_note(
  p_event_id uuid, p_item_id uuid, p_body text, p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.event_agenda_notes;
begin
  if not public.is_admin() then
    raise exception 'Staff access required.' using errcode='42501';
  end if;
  if p_body is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'A note and expected revision are required.' using errcode='22023';
  end if;
  -- Lock both identities until commit so a concurrent builder edit cannot
  -- remove/reassign the target while a note is being saved.
  perform 1 from public.event_agenda_items i
    join public.event_agenda_days d on d.id=i.event_agenda_day_id
    where i.id=p_item_id and d.event_id=p_event_id for share of i,d;
  if not found then
    raise exception 'Agenda item not found in this event.' using errcode='22023';
  end if;
  -- Concurrent first writes serialize on the primary key, then compete with
  -- the same revision predicate as subsequent writes. Empty text is valid.
  insert into public.event_agenda_notes(item_id) values(p_item_id)
    on conflict(item_id) do nothing;
  update public.event_agenda_notes set body=p_body, revision=revision+1
    where item_id=p_item_id and revision=p_expected_revision returning * into saved;
  if found then
    return jsonb_build_object('ok',true,'note',to_jsonb(saved));
  end if;
  select * into saved from public.event_agenda_notes where item_id=p_item_id;
  return jsonb_build_object('ok',false,'note',to_jsonb(saved));
end $$;
revoke all on function public.save_agenda_note(uuid,uuid,text,integer) from public,anon;
grant execute on function public.save_agenda_note(uuid,uuid,text,integer) to authenticated;
