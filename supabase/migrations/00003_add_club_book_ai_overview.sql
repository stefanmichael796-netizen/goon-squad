-- Stores the AI-generated, spoiler-free synopsis and character overview
-- for a club's current read. Run this in the Supabase SQL Editor.

ALTER TABLE club_books ADD COLUMN IF NOT EXISTS ai_synopsis text;
ALTER TABLE club_books ADD COLUMN IF NOT EXISTS ai_characters text;
