-- Club photo/logo: a column on clubs plus a public storage bucket to hold the
-- uploaded image. Run this in the Supabase SQL Editor.

alter table clubs add column if not exists logo_url text;

-- Public bucket for club logos (anyone can view; members upload via the app).
insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;

-- Public read; authenticated users can upload/replace/remove logos.
drop policy if exists "Club logos are publicly readable" on storage.objects;
create policy "Club logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'club-logos');

drop policy if exists "Authenticated users can upload club logos" on storage.objects;
create policy "Authenticated users can upload club logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'club-logos');

drop policy if exists "Authenticated users can update club logos" on storage.objects;
create policy "Authenticated users can update club logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'club-logos');

drop policy if exists "Authenticated users can delete club logos" on storage.objects;
create policy "Authenticated users can delete club logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'club-logos');
