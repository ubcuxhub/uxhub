-- At 10,000 registrations the invoker event summary spends ~1.2s repeating
-- identical admin RLS checks on each registration and check-in. This function
-- already rejects non-admin callers before reading any data, fixes its search
-- path, performs no dynamic SQL, and returns aggregate counts only. Execute
-- its reads as owner after that guard rather than reauthorizing every row.
-- Anonymous EXECUTE remains revoked; ordinary authenticated callers still
-- fail the is_admin() check in the function body.
alter function public.admin_event_analytics(timestamptz) security definer;
