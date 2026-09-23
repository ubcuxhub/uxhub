-- Allow a student number to appear on more than one profile.
--
-- `20260905120000_unique_student_number` made the number unique to stop one
-- real number backing many discounted memberships. In practice it also blocked
-- genuine students whose number was already on a profile they could not reach —
-- an imported membership under a different email, say — with no self-serve way
-- past it. Duplicates are now left for admins to spot and reconcile.

drop index if exists public.idx_user_info_student_number;
