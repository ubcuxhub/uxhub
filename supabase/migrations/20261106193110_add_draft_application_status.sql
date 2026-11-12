-- A member saves an application as a draft before submitting it.
--
-- On its own because a new enum value cannot be used in the transaction that
-- adds it; 20261106193112_application_drafts.sql puts it to work. Nothing
-- writes a draft until that migration lets members insert one, so the code
-- already in production never meets the value.
alter type public.event_application_status add value if not exists 'draft' before 'submitted';
