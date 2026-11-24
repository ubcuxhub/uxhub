#!/usr/bin/env bash
# Vercel's build command (see vercel.json). A production build applies pending
# migrations to the hosted database before `next build`, so the new schema is in
# place before the build prerenders against it and before the new code takes
# traffic. A failed migration fails the build, and the current deployment keeps
# serving. Preview builds never touch the hosted database.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  # Only merged migrations reach production: promoting a preview, or a
  # `vercel --prod` from a branch, would otherwise push that branch's.
  if [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]; then
    echo "Production builds must come from main (got '${VERCEL_GIT_COMMIT_REF:-}')." >&2
    exit 1
  fi

  if [ -z "${SUPABASE_MIGRATIONS_DB_URL:-}" ]; then
    echo "SUPABASE_MIGRATIONS_DB_URL is not set, so migrations cannot be applied." >&2
    exit 1
  fi

  # A no-op when nothing is pending. Fails on a migration that sorts before the
  # hosted history, and when the hosted history has a migration this commit
  # lacks (redeploying an older commit; use Instant Rollback instead).
  if ! pnpm exec supabase db push --db-url "$SUPABASE_MIGRATIONS_DB_URL" --yes; then
    # The out-of-order case lands here when a stale pull request was merged
    # after a newer migration (CI's "Check migration order" on the push to main
    # names the file). Every production deploy stays blocked until it is fixed.
    echo "supabase db push failed. If it found local migrations to insert before the" >&2
    echo "last one applied, rename that migration with a current timestamp in a new" >&2
    echo "pull request. Do not rerun with --include-all: it would apply it out of order." >&2
    exit 1
  fi
fi

pnpm build
