-- Allow club owners to delete club_books rows (e.g. removing a book from the shelf).
-- Run this in the Supabase SQL Editor.

create policy "Club owners can delete club books"
  on club_books for delete
  to authenticated
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = club_books.club_id
        and club_members.user_id = auth.uid()
        and club_members.role = 'owner'
    )
  );
