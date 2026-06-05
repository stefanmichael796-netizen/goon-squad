-- Club logo lives directly in the clubs table as a small data-URL string, so no
-- Supabase Storage bucket is required. This just makes sure the column exists.
-- Run this in the Supabase SQL Editor.

alter table clubs add column if not exists logo_url text;
