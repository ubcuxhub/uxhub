# How to Run Supabase Migrations

```
supabase login
supabase link
```

```
supabase db pull
```

(Make sure docker desktop is running)

## Typical Workflow:

```
# 1. Create a new migration
supabase migration new add_user_profiles

# 2. Write your SQL in the generated file
supabase/migrations/20260111_add_user_profiles.sql

# 3. Push to remote when ready
supabase db push
```

## Guidelines:

- Never edit old migrations that have been applied—create new ones instead
- Keep migrations small and focused (one logical change per file)
- Use descriptive names: add_user_avatar_column.sql not update.sql
- Include rollback logic in comments (Supabase doesn't auto-rollback, but it's good documentation)
- Don't mix db pull and db push in the same workflow—pick one direction
