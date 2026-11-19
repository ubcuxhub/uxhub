-- A check made after waiting on an event lock must see registrations that
-- committed while it waited, rather than the original UPDATE snapshot.
alter function public.admin_event_pricing_locked(uuid) volatile;

-- Held application offers lock prices too. Serialize their creation/extension
-- with form updates, including callers that bypass the reservation function.
create trigger guard_event_offer_configuration before insert or update of event_id, status, offer_expires_at on public.event_applications
for each row when (new.status = 'accepted') execute function public.guard_event_checkout_configuration();
