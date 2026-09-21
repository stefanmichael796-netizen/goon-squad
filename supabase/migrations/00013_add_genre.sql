-- A distinct, human-friendly genre per book, filled in by AI (Google Books
-- categories are too coarse — almost everything is just "Fiction").
-- Run this in the Supabase SQL Editor.

alter table books add column if not exists genre text;
