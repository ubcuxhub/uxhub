-- storage.objects.bucket_id references storage.buckets(id), so object rows must
-- go first.
--
-- This removes metadata rows only. The stored files themselves are not deleted
-- by SQL -- purge them through the Storage API or the dashboard.

delete from storage.objects where bucket_id = 'event-images';
delete from storage.buckets where id = 'event-images';
