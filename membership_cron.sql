
-- this is likely incorrect, but we need sth like this

select cron.schedule(
  'handle_expired_memberships',
  '0 * * * *',
  $$
    update user_info
    set 
      -- If they have a pre-order, switch to it; otherwise set to null
      membership_type_id = membership_pre_ordered_type_id,
      
      -- Clear the pre-order field since it's now active
      membership_pre_ordered_type_id = null,
      
      -- Example logic: If switching to pre-order, set new expiration (e.g., +1 year)
      -- Otherwise clear the expiration date
      membership_expires_at = case 
        when membership_pre_ordered_type_id is not null then now() + interval '1 year'
        else null 
      end
    where 
      membership_expires_at < now() 
      and membership_type_id is not null;
  $$
);