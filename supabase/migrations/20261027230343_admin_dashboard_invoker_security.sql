-- The canonical check-in policies already use is_admin(), which includes
-- managers. Keep the explicit analytics authorization guard and also retain
-- the caller's RLS permissions; aggregate queries need no owner privileges.
alter function public.admin_membership_analytics(timestamptz) security invoker;
alter function public.admin_event_analytics(timestamptz) security invoker;
