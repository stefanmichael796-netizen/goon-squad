-- Backfill the club shelf from books that were already logged as "read" and
-- shared to a club, but never got a club_books row. Adds them as past reads
-- (date read = the log date) without touching any current read.
--
-- Run once in the Supabase SQL Editor. Afterwards you can fix each book's
-- "Date read" from the book sheet on the club page.

insert into club_books (club_id, book_id, status, ended_on)
select distinct on (l.club_id, l.book_id)
  l.club_id,
  l.book_id,
  'past',
  l.created_at::date
from logs l
where l.club_id is not null
  and l.shelf = 'read'
  and not exists (
    select 1 from club_books cb
    where cb.club_id = l.club_id
      and cb.book_id = l.book_id
  )
order by l.club_id, l.book_id, l.created_at desc;
