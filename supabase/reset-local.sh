#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "Starting local Supabase services..."
pnpm exec supabase start

echo "Rebuilding the local database and applying all migrations..."
pnpm exec supabase db reset --local

echo "Loading mock memberships, events, users, and related records..."
pnpm seed

echo "Local Supabase is ready."
