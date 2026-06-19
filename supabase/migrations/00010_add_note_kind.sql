-- Allow "note" as a log kind for personal notes on books.
-- Run this in the Supabase SQL Editor.

alter table logs drop constraint if exists logs_kind_check;
alter table logs add constraint logs_kind_check
  check (kind in ('review', 'shelf_change', 'progress', 'favourite', 'note'));
