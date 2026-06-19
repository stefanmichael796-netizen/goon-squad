-- ============================================================
-- Goon Squad — consolidated pending migrations (00006–00012)
-- Safe to run as a whole in the Supabase SQL Editor. Idempotent:
-- re-running it will not error, even if you've already applied some.
-- ============================================================

-- 00006: club owners can remove books from the shelf
drop policy if exists "Club owners can delete club books" on club_books;
create policy "Club owners can delete club books"
  on club_books for delete
  to authenticated
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = club_books.club_id
        and club_members.user_id = auth.uid()
        and club_members.role = 'owner'
    )
  );

-- 00007: club logo stored as a data-URL on the clubs row
alter table clubs add column if not exists logo_url text;

-- 00008: users can delete their own logs (e.g. clearing a rating)
drop policy if exists "Users can delete own logs" on logs;
create policy "Users can delete own logs"
  on logs for delete
  to authenticated
  using (auth.uid() = user_id);

-- 00009: who recommended each book
alter table club_books add column if not exists recommended_by text;

-- 00010: allow "note" (and "reread") as log kinds
alter table logs drop constraint if exists logs_kind_check;
alter table logs add constraint logs_kind_check
  check (kind in ('review', 'shelf_change', 'progress', 'favourite', 'reread', 'note'));

-- 00011: cache AI notable quotes on the club_books row
alter table club_books add column if not exists ai_quotes text;

-- 00012: cache AI overview on the shared books table (for personal books)
alter table books add column if not exists ai_synopsis text;
alter table books add column if not exists ai_characters text;
alter table books add column if not exists ai_quotes text;

drop policy if exists "Authenticated users can update books" on books;
create policy "Authenticated users can update books"
  on books for update
  to authenticated
  using (true)
  with check (true);
