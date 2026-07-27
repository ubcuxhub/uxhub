# Plans

Multi-file plans get a folder. Single-file plans live at the root. Archive when done.

```
docs/designs/
  archived/              # finished or abandoned work
  <slug-1>.md            # single-file plan (no folder needed)
  <slug-2>/              # multi-file plan
    <slug-2>.md          # overview / concise phasing guide
    phase-N.md           # execution plan for phase N
```

## Drafting a plan

- Make the plan easy to read.
- always draft single file plans, unless explicitly told otherwise
- Before drafting a plan, ask the user questions if any decisions are unclear
- When archiving, move under `archived/` with a `YYYY-MM-` prefix (month the work finished), e.g. `archived/2026-07-template-redesign/` or `archived/2026-03-foo-bar.md`.
- Use kebab-case for folders and files.

## Implementing a plan

- If you did not author the plan, review it carefully first.
- If the current branch seems wrong, push it and check out a new branch with an appropriate name before starting.
- If the plan is genuinely too large to implement in one go, split it into phases and implement them one at a time. Prefer fewer phases over more.
  - To split a single-file plan, create a folder and move the file inside unchanged, add a concise phasing section to it, then review the current implementation to draft each `phase-N.md`.
  - When done drafting the `phase-N.md` plans simply proceed to implement them in order, verifying after each phase.
- Stop only when there is a genuine problem that requires the user's attention.
- When done, briefly summarize what you changed and how the user can verify it (if verification is needed).
