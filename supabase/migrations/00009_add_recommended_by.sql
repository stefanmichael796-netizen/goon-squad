-- Track who recommended each book.
-- Run this in the Supabase SQL Editor.

alter table club_books add column if not exists recommended_by text;
