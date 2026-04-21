-- Goon Squad Seed Data
-- Creates demo data so the app looks alive on first run.
-- Run after migrations. Requires a user to exist in auth.users first.
-- For local dev, create a user via the Supabase dashboard or auth API,
-- then update the IDs below.

-- NOTE: Replace these UUIDs with real user IDs from your auth.users table.
-- User 1: demo@goonsquad.app
-- User 2: reader@goonsquad.app

-- If you're running Supabase locally, create users first:
--   INSERT INTO auth.users (id, email, ...) VALUES (...);
-- Then update the UUIDs below.

DO $$
DECLARE
  user1_id uuid := '00000000-0000-0000-0000-000000000001';
  user2_id uuid := '00000000-0000-0000-0000-000000000002';
  club_id uuid := gen_random_uuid();
  book1_id uuid := gen_random_uuid();
  book2_id uuid := gen_random_uuid();
  book3_id uuid := gen_random_uuid();
  book4_id uuid := gen_random_uuid();
  book5_id uuid := gen_random_uuid();
  cb1_id uuid := gen_random_uuid();
BEGIN

  -- Insert profiles (will fail if users don't exist in auth.users; that's fine)
  INSERT INTO profiles (id, display_name, bio) VALUES
    (user1_id, 'Sasha', 'Reading my way through the century.'),
    (user2_id, 'Bennie', 'Bass player, book reader.')
  ON CONFLICT (id) DO NOTHING;

  -- Insert books
  INSERT INTO books (id, google_books_id, title, authors, cover_url, page_count, categories, published_date, publisher, description) VALUES
    (book1_id, 'gbs_goon_squad', 'A Visit from the Goon Squad', ARRAY['Jennifer Egan'], 'https://books.google.com/books/content?id=Yz8Fnw0PlEQC&printsec=frontcover&img=1&zoom=1', 352, ARRAY['Fiction', 'Literary Fiction'], '2010', 'Knopf', 'A novel about music, time, and the way we change.'),
    (book2_id, 'gbs_great_gatsby', 'The Great Gatsby', ARRAY['F. Scott Fitzgerald'], 'https://books.google.com/books/content?id=iXn5U2IzVH0C&printsec=frontcover&img=1&zoom=1', 180, ARRAY['Fiction', 'Classics'], '1925', 'Scribner', 'The story of the mysteriously wealthy Jay Gatsby.'),
    (book3_id, 'gbs_normal_people', 'Normal People', ARRAY['Sally Rooney'], 'https://books.google.com/books/content?id=MsDjDwAAQBAJ&printsec=frontcover&img=1&zoom=1', 273, ARRAY['Fiction', 'Literary Fiction'], '2018', 'Faber & Faber', 'Connell and Marianne grow up in the same small town in the west of Ireland.'),
    (book4_id, 'gbs_pachinko', 'Pachinko', ARRAY['Min Jin Lee'], 'https://books.google.com/books/content?id=R5CeDQAAQBAJ&printsec=frontcover&img=1&zoom=1', 490, ARRAY['Fiction', 'Historical Fiction'], '2017', 'Grand Central Publishing', 'A sweeping saga of a Korean family across four generations.'),
    (book5_id, 'gbs_klara', 'Klara and the Sun', ARRAY['Kazuo Ishiguro'], 'https://books.google.com/books/content?id=Wx0nEAAAQBAJ&printsec=frontcover&img=1&zoom=1', 303, ARRAY['Fiction', 'Science Fiction'], '2021', 'Knopf', 'An Artificial Friend observes the world from a store shelf.')
  ON CONFLICT (google_books_id) DO NOTHING;

  -- Create the club
  INSERT INTO clubs (id, name, description, created_by, invite_code) VALUES
    (club_id, 'The Goon Squad', 'For those who know time is a goon.', user1_id, 'GOON42')
  ON CONFLICT (invite_code) DO NOTHING;

  -- Add members
  INSERT INTO club_members (club_id, user_id, role) VALUES
    (club_id, user1_id, 'owner'),
    (club_id, user2_id, 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;

  -- Club book (current pick)
  INSERT INTO club_books (id, club_id, book_id, status, started_on) VALUES
    (cb1_id, club_id, book1_id, 'current', CURRENT_DATE - INTERVAL '14 days')
  ON CONFLICT DO NOTHING;

  -- User books (shelves)
  INSERT INTO user_books (user_id, book_id, shelf, is_favourite, favourite_rank, progress_pct, progress_page, started_at, finished_at, created_at, updated_at) VALUES
    (user1_id, book1_id, 'reading', false, null, 45.0, 158, CURRENT_DATE - INTERVAL '14 days', null, now(), now()),
    (user1_id, book2_id, 'read', true, 1, null, null, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days', now(), now()),
    (user1_id, book3_id, 'read', true, 2, null, null, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '70 days', now(), now()),
    (user1_id, book4_id, 'want', false, null, null, null, null, null, now(), now()),
    (user2_id, book1_id, 'reading', false, null, 20.0, 70, CURRENT_DATE - INTERVAL '10 days', null, now(), now()),
    (user2_id, book5_id, 'read', true, 1, null, null, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '20 days', now(), now())
  ON CONFLICT (user_id, book_id) DO NOTHING;

  -- Logs
  INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, review, shelf, progress_pct, created_at) VALUES
    (user1_id, book2_id, null, null, 'review', 4.5, 'Fitzgerald knew something about longing that most writers only pretend to.', 'read', null, now() - INTERVAL '30 days'),
    (user1_id, book3_id, null, null, 'review', 4.0, 'Quietly devastating. Rooney makes the ordinary feel enormous.', 'read', null, now() - INTERVAL '70 days'),
    (user1_id, book1_id, club_id, cb1_id, 'shelf_change', null, null, 'reading', null, now() - INTERVAL '14 days'),
    (user1_id, book1_id, club_id, cb1_id, 'progress', null, null, null, 45.0, now() - INTERVAL '2 days'),
    (user2_id, book5_id, null, null, 'review', 3.5, 'Beautiful and strange. The ending sat with me for days.', 'read', null, now() - INTERVAL '20 days'),
    (user2_id, book1_id, club_id, cb1_id, 'shelf_change', null, null, 'reading', null, now() - INTERVAL '10 days');

  -- Quotes
  INSERT INTO quotes (user_id, book_id, club_id, body, page_number, note, created_at) VALUES
    (user1_id, book2_id, null, 'So we beat on, boats against the current, borne back ceaselessly into the past.', 180, 'The last line. Perfect.', now() - INTERVAL '29 days'),
    (user1_id, book1_id, club_id, 'Time is a goon, right? You gonna let that goon push you around?', 127, null, now() - INTERVAL '3 days');

  -- Club comment
  INSERT INTO club_comments (club_book_id, user_id, body, created_at) VALUES
    (cb1_id, user1_id, 'Chapter 3 really picks up. The structure is wild.', now() - INTERVAL '5 days'),
    (cb1_id, user2_id, 'Just started. The PowerPoint chapter is already legendary.', now() - INTERVAL '3 days');

END $$;
