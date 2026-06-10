-- Allow users to delete their own log entries (e.g. clearing a stuck rating).
-- Run this in the Supabase SQL Editor.

create policy "Users can delete own logs"
  on logs for delete
  to authenticated
  using (auth.uid() = user_id);
