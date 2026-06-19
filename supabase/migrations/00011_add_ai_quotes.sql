-- Cache AI-generated notable quotes on the club_books row.
-- Run this in the Supabase SQL Editor.

alter table club_books add column if not exists ai_quotes text;
