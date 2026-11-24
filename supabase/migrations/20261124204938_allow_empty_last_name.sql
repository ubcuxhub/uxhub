-- Members with a single name (mononyms) can finish their profile: the last
-- name becomes optional. A missing last name is stored as the empty string,
-- so the column stays NOT NULL and every reader keeps getting a string. The
-- value must still be trimmed, so '  x ' and '   ' are refused. The first
-- name stays required.
--
-- Backward-compatible: the code already in production always writes a
-- non-empty, trimmed last name, which both the old and new checks accept.
-- No database function rejects an empty last name: names reach user_info
-- through the app's inserts and updates, and the display helpers in SQL
-- (`concat_ws` + `trim`) already drop an empty part.

alter table public.user_info
  drop constraint user_info_last_name_trimmed_nonempty,
  add constraint user_info_last_name_trimmed
    check (last_name = btrim(last_name));
