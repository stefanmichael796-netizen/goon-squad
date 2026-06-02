-- Adds editable "main characters" field to club books
-- Run this in the Supabase SQL Editor

ALTER TABLE club_books ADD COLUMN IF NOT EXISTS characters text;
