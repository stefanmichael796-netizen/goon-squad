-- Cache AI overview (synopsis, characters, notable quotes) on the shared books
-- table so personal books get the same treatment as club books.
-- Run this in the Supabase SQL Editor.

alter table books add column if not exists ai_synopsis text;
alter table books add column if not exists ai_characters text;
alter table books add column if not exists ai_quotes text;

-- Books are shared/global. Authenticated users can already insert them; allow
-- updates too so the cached AI overview can be written back.
drop policy if exists "Authenticated users can update books" on books;
create policy "Authenticated users can update books"
  on books for update
  to authenticated
  using (true)
  with check (true);
