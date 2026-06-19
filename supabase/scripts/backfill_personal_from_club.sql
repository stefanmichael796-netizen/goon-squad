-- ============================================================
-- Backfill the Personal tab from a member's club history.
-- For every book on a club's shelf, add it to that member's personal
-- "read" shelf, and copy their club rating across as a personal rating.
-- Idempotent: re-running won't create duplicates.
-- Run in the Supabase SQL Editor.
-- ============================================================

-- 1. Add each past club book to the member's personal "read" shelf.
insert into user_books (user_id, book_id, shelf, finished_at)
select distinct cm.user_id, cb.book_id, 'read', cb.ended_on
from club_books cb
join club_members cm on cm.club_id = cb.club_id
where cb.status = 'past'
  and not exists (
    select 1 from user_books ub
    where ub.user_id = cm.user_id
      and ub.book_id = cb.book_id
  );

-- 2. Also pull the club's current read onto the member's "reading" shelf.
insert into user_books (user_id, book_id, shelf, started_at)
select distinct cm.user_id, cb.book_id, 'reading', cb.started_on
from club_books cb
join club_members cm on cm.club_id = cb.club_id
where cb.status = 'current'
  and not exists (
    select 1 from user_books ub
    where ub.user_id = cm.user_id
      and ub.book_id = cb.book_id
  );

-- 3. Copy each member's most recent club rating into a personal (club_id null)
--    rating, unless they already have one for that book.
insert into logs (user_id, book_id, kind, rating, club_id)
select distinct on (l.user_id, l.book_id)
  l.user_id, l.book_id, 'review', l.rating, null
from logs l
where l.club_id is not null
  and l.kind in ('review', 'reread')
  and l.rating is not null
  and not exists (
    select 1 from logs p
    where p.user_id = l.user_id
      and p.book_id = l.book_id
      and p.club_id is null
      and p.kind in ('review', 'reread')
      and p.rating is not null
  )
order by l.user_id, l.book_id, l.created_at desc;
