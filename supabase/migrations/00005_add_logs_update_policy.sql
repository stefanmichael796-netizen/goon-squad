-- Allow users to update their own log entries (e.g. changing a rating).
-- Run this in the Supabase SQL Editor.

create policy "Users can update own logs"
  on logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
