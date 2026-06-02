-- Wipe the seeded book-club history (past reads) so it can be re-entered with
-- real info. This removes every "past" club book plus the club ratings/reviews
-- and quotes attached to those books. Your CURRENT read is left untouched.
--
-- Run this once in the Supabase SQL Editor.

begin;

-- Club ratings/reviews logged against books that were past club reads.
delete from logs
where club_id is not null
  and book_id in (select book_id from club_books where status = 'past');

-- Quotes saved against books that were past club reads.
delete from quotes
where club_id is not null
  and book_id in (select book_id from club_books where status = 'past');

-- The past club_books rows themselves (the shelf history).
delete from club_books where status = 'past';

commit;
