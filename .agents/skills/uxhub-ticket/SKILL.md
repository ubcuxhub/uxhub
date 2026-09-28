---
name: uxhub-ticket
description: Create a ticket on the UX Hub Engineering "Tickets" board in Notion. Use whenever the user asks to write, file, add, or draft a ticket for UX Hub work.
---

# UX Hub ticket

Tickets live in the Notion **Tickets** database on the Engineering page.

- Data source: `collection://e4040300-2612-487e-b0d6-120641882a32`
- Default template: `3bd2f9f0-9f18-80f7-9a46-dd79f7d02a41` (adds `## Acceptance Criteria` and `## Notes`)
- Status options: `Backlog`, `Draft`, `Ready`, `Assigned`, `Completed`. Default to `Ready`.
- Don't set `Assignee` or `Date assigned` unless asked (automation sets `Date assigned`).

## Steps

1. Search Notion for a ticket covering the same work; if one exists, mention it.
2. `notion-create-pages` with parent `data_source_id`, `template_id`, `allow_async: false`, and properties:
   `Name`, `Status`, `date:Deadline:start` (`YYYY-MM-DD`), `date:Deadline:is_datetime: 0`.
   Pass `effort: "Small"` only if asked.
3. Fetch the page, then fill both sections with `notion-update-page` `update_content`, matching the
   template's existing text (e.g. `## Acceptance Criteria\n<empty-block/>\n## Notes`).
4. Reply with the ticket ID (`UX-n`), link, status, and deadline. If a relative date was ambiguous, say which date you picked.

## Writing

- Bullets only, under 50 words total across both sections.
- Acceptance Criteria: observable outcomes. Notes: why, context, gotchas.
- Plain and human; describe the work as not yet done, even if it already exists locally.
- Use real file and component names from the repo in backticks.
