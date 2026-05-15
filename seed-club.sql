-- Seed script: populate club with 6 members and 20 books from spreadsheet
-- Run this in the Supabase SQL Editor

-- Step 1: Find existing club and user (Stef)
DO $$
DECLARE
  v_club_id uuid;
  v_stef_id uuid;
  v_tj_id uuid := gen_random_uuid();
  v_pat_id uuid := gen_random_uuid();
  v_luke_id uuid := gen_random_uuid();
  v_blake_id uuid := gen_random_uuid();
  v_suff_id uuid := gen_random_uuid();
  v_book_ids uuid[] := ARRAY[]::uuid[];
  v_bid uuid;
  v_cb_id uuid;
BEGIN
  -- Find Stef (the real user) and their club
  SELECT cm.club_id, cm.user_id INTO v_club_id, v_stef_id
  FROM club_members cm LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'No club found. Create a club first.';
  END IF;

  -- Step 2: Create fake auth users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
  VALUES
    (v_tj_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tj@goonsquad.fake', crypt('password123', gen_salt('bf')), now(), now(), now(), '', ''),
    (v_pat_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pat@goonsquad.fake', crypt('password123', gen_salt('bf')), now(), now(), now(), '', ''),
    (v_luke_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luke@goonsquad.fake', crypt('password123', gen_salt('bf')), now(), now(), now(), '', ''),
    (v_blake_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'blake@goonsquad.fake', crypt('password123', gen_salt('bf')), now(), now(), now(), '', ''),
    (v_suff_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'suff@goonsquad.fake', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '');

  -- Step 3: Create profiles
  INSERT INTO profiles (id, display_name, created_at) VALUES
    (v_tj_id, 'TJ', now()),
    (v_pat_id, 'Pat', now()),
    (v_luke_id, 'Luke', now()),
    (v_blake_id, 'Blake', now()),
    (v_suff_id, 'Suff', now())
  ON CONFLICT (id) DO NOTHING;

  -- Step 4: Add as club members
  INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES
    (v_club_id, v_tj_id, 'member', now()),
    (v_club_id, v_pat_id, 'member', now()),
    (v_club_id, v_luke_id, 'member', now()),
    (v_club_id, v_blake_id, 'member', now()),
    (v_club_id, v_suff_id, 'member', now())
  ON CONFLICT DO NOTHING;

  -- Step 5: Create 20 books
  -- We'll store IDs in an array as we go (index 1-20)

  -- 1. Outline
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_outline', 'Outline', ARRAY['Rachel Cusk'], 249, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 2. Where the Crawdads Sing
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_crawdads', 'Where the Crawdads Sing', ARRAY['Delia Owens'], 384, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 3. The Midnight Library
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_midnight_lib', 'The Midnight Library', ARRAY['Matt Haig'], 304, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 4. The Nightingale
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_nightingale', 'The Nightingale', ARRAY['Kristin Hannah'], 440, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 5. A Visit From the Goon Squad
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_goon_squad', 'A Visit From the Goon Squad', ARRAY['Jennifer Egan'], 352, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 6. Denizen
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_denizen', 'Denizen', ARRAY['Sarah Crossan'], 224, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 7. The Seven Moons of Maali Almeida
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_maali', 'The Seven Moons of Maali Almeida', ARRAY['Shehan Karunatilaka'], 400, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 8. Elena Knows
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_elena', 'Elena Knows', ARRAY['Claudia Piñeiro'], 192, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 9. The Silent Patient
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_silent', 'The Silent Patient', ARRAY['Alex Michaelides'], 336, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 10. Night Boat to Tangier
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_tangier', 'Night Boat to Tangier', ARRAY['Kevin Barry'], 224, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 11. A Man
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_aman', 'A Man', ARRAY['Keiichiro Hirano'], 320, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 12. An Unfinished Season
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_unfinished', 'An Unfinished Season', ARRAY['Ward Just'], 272, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 13. Prophet Song
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_prophet', 'Prophet Song', ARRAY['Paul Lynch'], 320, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 14. The Turning
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_turning', 'The Turning', ARRAY['Tim Winton'], 320, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 15. Rouge
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_rouge', 'Rouge', ARRAY['Mona Awad'], 352, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 16. The Trees
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_trees', 'The Trees', ARRAY['Percival Everett'], 320, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 17. A Gentleman in Moscow
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_gentleman', 'A Gentleman in Moscow', ARRAY['Amor Towles'], 480, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 18. Butter
  INSERT INTO books (id, google_books_id, title, authors, page_count, created_at)
  VALUES (gen_random_uuid(), 'seed_butter', 'Butter', ARRAY['Asako Yuzuki'], 464, now())
  RETURNING id INTO v_bid;
  v_book_ids := array_append(v_book_ids, v_bid);

  -- 19. (placeholder for future)
  -- 20. (placeholder for future)

  -- Step 6: Create club_books (all as "past")
  FOR i IN 1..18 LOOP
    INSERT INTO club_books (id, club_id, book_id, status, started_on, ended_on)
    VALUES (gen_random_uuid(), v_club_id, v_book_ids[i], 'past', (now() - interval '1 month' * (19 - i))::date, (now() - interval '1 month' * (18 - i))::date)
    RETURNING id INTO v_cb_id;

    -- Step 7: Insert ratings as logs
    -- Each book gets ratings per member based on the spreadsheet

    IF i = 1 THEN -- Outline: TJ 3.5, Stef 4.3
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '17 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.3, 'read', now() - interval '17 months');
    END IF;

    IF i = 2 THEN -- Where the Crawdads Sing: TJ 3, Stef 2.5, Pat 3, Luke 3.8
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '16 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.5, 'read', now() - interval '16 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '16 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '16 months');
    END IF;

    IF i = 3 THEN -- The Midnight Library: TJ 0.1, Stef 0.1, Pat 1, Luke 3
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 0.1, 'read', now() - interval '15 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 0.1, 'read', now() - interval '15 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 1.0, 'read', now() - interval '15 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '15 months');
    END IF;

    IF i = 4 THEN -- The Nightingale: TJ 2.5, Stef 1, Pat 3, Luke 3.5
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.5, 'read', now() - interval '14 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 1.0, 'read', now() - interval '14 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '14 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '14 months');
    END IF;

    IF i = 5 THEN -- A Visit From the Goon Squad: TJ 4.3, Stef 4.2, Pat 3.5, Luke 4.5
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.3, 'read', now() - interval '13 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.2, 'read', now() - interval '13 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '13 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.5, 'read', now() - interval '13 months');
    END IF;

    IF i = 6 THEN -- Denizen: TJ 4.1, Stef 3.8, Pat 3.4, Luke 3.9, Blake 4.2
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.1, 'read', now() - interval '12 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '12 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.4, 'read', now() - interval '12 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.9, 'read', now() - interval '12 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.2, 'read', now() - interval '12 months');
    END IF;

    IF i = 7 THEN -- Seven Moons: TJ 3.9, Stef 3.8, Pat 3.1, Luke 3, Blake 3.2
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.9, 'read', now() - interval '11 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '11 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.1, 'read', now() - interval '11 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '11 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.2, 'read', now() - interval '11 months');
    END IF;

    IF i = 8 THEN -- Elena Knows: TJ 3.1, Stef 4.2, Pat 4, Luke 3.3, Blake 3
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.1, 'read', now() - interval '10 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.2, 'read', now() - interval '10 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '10 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.3, 'read', now() - interval '10 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '10 months');
    END IF;

    IF i = 9 THEN -- Silent Patient: TJ 2, Stef 2, Pat 2, Luke 3.1, Blake 3.1, Suff 2.5
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.0, 'read', now() - interval '9 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.0, 'read', now() - interval '9 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.0, 'read', now() - interval '9 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.1, 'read', now() - interval '9 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.1, 'read', now() - interval '9 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.5, 'read', now() - interval '9 months');
    END IF;

    IF i = 10 THEN -- Night Boat to Tangier: TJ 4, Stef 4, Pat 4.1, Luke 3.8, Blake 4, Suff 3.9
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '8 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '8 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.1, 'read', now() - interval '8 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '8 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '8 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.9, 'read', now() - interval '8 months');
    END IF;

    IF i = 11 THEN -- A Man: TJ 1, Stef 1.9, Pat 3, Luke 2, Blake 2.5, Suff 1.7
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 1.0, 'read', now() - interval '7 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 1.9, 'read', now() - interval '7 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '7 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.0, 'read', now() - interval '7 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.5, 'read', now() - interval '7 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 1.7, 'read', now() - interval '7 months');
    END IF;

    IF i = 12 THEN -- An Unfinished Season: TJ 4, Stef 3.8, Blake 3.6, Suff 2.6
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '6 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '6 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.6, 'read', now() - interval '6 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.6, 'read', now() - interval '6 months');
    END IF;

    IF i = 13 THEN -- Prophet Song: TJ 3.5, Stef 3.7, Blake 3.9, Suff 4.2
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '5 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.7, 'read', now() - interval '5 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.9, 'read', now() - interval '5 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.2, 'read', now() - interval '5 months');
    END IF;

    IF i = 14 THEN -- The Turning: TJ 4, Stef 4, Pat 3.4, Luke 3.8, Blake 3.8, Suff 3.6
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '4 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.0, 'read', now() - interval '4 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.4, 'read', now() - interval '4 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '4 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.8, 'read', now() - interval '4 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.6, 'read', now() - interval '4 months');
    END IF;

    IF i = 15 THEN -- Rouge: TJ 3.5, Stef 3.6, Pat 3, Luke 3.3, Blake 2.9, Suff 3.1
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '3 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.6, 'read', now() - interval '3 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.0, 'read', now() - interval '3 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.3, 'read', now() - interval '3 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.9, 'read', now() - interval '3 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.1, 'read', now() - interval '3 months');
    END IF;

    IF i = 16 THEN -- The Trees: TJ 3.7, Stef 3.5, Pat 3.5, Luke 3.1, Blake 1, Suff 4.1
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.7, 'read', now() - interval '2 months'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '2 months'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.5, 'read', now() - interval '2 months'),
        (v_luke_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.1, 'read', now() - interval '2 months'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 1.0, 'read', now() - interval '2 months'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.1, 'read', now() - interval '2 months');
    END IF;

    IF i = 17 THEN -- Gentleman in Moscow: TJ 4.6, Stef 3.6, Pat 4.2, Blake 4.7, Suff 3.9
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.6, 'read', now() - interval '1 month'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.6, 'read', now() - interval '1 month'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.2, 'read', now() - interval '1 month'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 4.7, 'read', now() - interval '1 month'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.9, 'read', now() - interval '1 month');
    END IF;

    IF i = 18 THEN -- Butter: TJ 3.2, Stef 2.8, Pat 2.5, Blake 2.5, Suff 2.4
      INSERT INTO logs (user_id, book_id, club_id, club_book_id, kind, rating, shelf, created_at) VALUES
        (v_tj_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 3.2, 'read', now() - interval '2 weeks'),
        (v_stef_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.8, 'read', now() - interval '2 weeks'),
        (v_pat_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.5, 'read', now() - interval '2 weeks'),
        (v_blake_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.5, 'read', now() - interval '2 weeks'),
        (v_suff_id, v_book_ids[i], v_club_id, v_cb_id, 'review', 2.4, 'read', now() - interval '2 weeks');
    END IF;

  END LOOP;

  RAISE NOTICE 'Seeded % books with ratings for 6 members in club %', array_length(v_book_ids, 1), v_club_id;
END $$;
