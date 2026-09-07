-- Member benefits are one sentence per tier now, so `description` carries them
-- on the plans screen, the checkout summary, and the portal membership card.
-- That leaves `features` with no reader in the app, so it goes.
--
-- The copy is written here rather than in the seed because
-- `pnpm seed --target=prod` never writes membership tiers: `supabase db push`
-- is the only path that reaches the production rows.
--
-- UXathon is application-gated for every tier, so each description says so;
-- Innovator is the one that buys past it.

update "public"."membership_types"
set "description" =
  'Free or discounted entry to every UX Hub event, except UXathon.'
where "slug" = 'explorer';

update "public"."membership_types"
set "description" =
  'A guaranteed spot at UXathon, plus free or discounted entry to every other UX Hub event.'
where "slug" = 'innovator';

update "public"."membership_types"
set "description" =
  'Free or discounted entry to every UX Hub event, except UXathon.'
where "slug" = 'faculty';

update "public"."membership_types"
set "description" =
  'Free or discounted entry to every UX Hub event, except UXathon.'
where "slug" = 'non-ubc';

alter table "public"."membership_types" drop column "features";
