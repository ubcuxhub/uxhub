create or replace function public.delete_event_atomically(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.purchases
    where event_id = target_event_id
      and status in ('authorized', 'completed')
  ) then
    raise exception 'Unable to delete the event because it has successful purchases.';
  end if;

  if exists (
    select 1
    from public.purchases
    where event_id = target_event_id
      and status <> 'failed'
  ) then
    raise exception 'This event has purchases that are not failed, so it cannot be deleted.';
  end if;

  delete from public.purchases
  where event_id = target_event_id
    and status = 'failed';

  delete from public.events
  where id = target_event_id;
end;
$$;
