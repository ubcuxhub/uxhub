#!/usr/bin/env bash
# Fails when a migration that HEAD adds sorts at or before the newest migration
# on the base ref. The production build's `supabase db push` refuses a migration
# older than the hosted history, so an out-of-order file would block the deploy
# that follows the merge. Usage: check-migration-order.sh <base-ref>
set -euo pipefail

base="${1:?usage: check-migration-order.sh <base-ref>}"
dir=supabase/migrations

list_migrations() {
  git ls-tree --name-only "$1" "$dir/" | sed 's|.*/||' | grep '\.sql$' | sort
}

base_files="$(list_migrations "$base")"
latest="$(tail -n 1 <<<"$base_files" | cut -d_ -f1)"
added="$(comm -13 <(echo "$base_files") <(list_migrations HEAD))"

status=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  version="${file%%_*}"
  # Versions are fixed-width timestamps, so string order is time order.
  if [[ ! "$version" > "$latest" ]]; then
    echo "::error file=$dir/$file::$file sorts before the newest migration on the base branch ($latest). Rename it with a current timestamp: \$(date -u +%Y%m%d%H%M%S)_${file#*_}" >&2
    status=1
  fi
done <<<"$added"

exit "$status"
