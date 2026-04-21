-- Goon Squad: Initial Schema
-- All tables, indexes, and RLS policies for the reading tracker.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now() not null
);

alter table profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ============================================================
-- BOOKS
-- ============================================================
create table books (
  id uuid primary key default gen_random_uuid(),
  google_books_id text unique,
  title text not null,
  authors text[] default '{}',
  author_countries text[],
  cover_url text,
  isbn_13 text,
  page_count int,
  categories text[],
  published_date text,
  publisher text,
  description text,
  created_at timestamptz default now() not null
);

alter table books enable row level security;

create policy "Books are viewable by authenticated users"
  on books for select
  to authenticated
  using (true);

create policy "Authenticated users can insert books"
  on books for insert
  to authenticated
  with check (true);

create index idx_books_google_id on books (google_books_id);

-- ============================================================
-- CLUBS
-- ============================================================
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references profiles on delete set null,
  invite_code text unique not null,
  created_at timestamptz default now() not null
);

alter table clubs enable row level security;

-- ============================================================
-- CLUB MEMBERS
-- ============================================================
create table club_members (
  club_id uuid references clubs on delete cascade,
  user_id uuid references profiles on delete cascade,
  role text check (role in ('owner', 'member')) default 'member' not null,
  joined_at timestamptz default now() not null,
  primary key (club_id, user_id)
);

alter table club_members enable row level security;

-- Club RLS: readable/writable by members
create policy "Club members can view their clubs"
  on clubs for select
  to authenticated
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
    )
  );

-- Allow reading clubs by invite code for joining
create policy "Anyone can read clubs by invite code"
  on clubs for select
  to authenticated
  using (true);

create policy "Authenticated users can create clubs"
  on clubs for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Club owners can update clubs"
  on clubs for update
  to authenticated
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
        and club_members.role = 'owner'
    )
  );

-- Club members RLS
create policy "Club members can view fellow members"
  on club_members for select
  to authenticated
  using (
    exists (
      select 1 from club_members as cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
    )
  );

create policy "Users can join clubs"
  on club_members for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can leave clubs"
  on club_members for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- CLUB BOOKS
-- ============================================================
create table club_books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  status text check (status in ('current', 'past', 'upcoming')) default 'current' not null,
  started_on date,
  ended_on date,
  target_end_date date
);

alter table club_books enable row level security;

create policy "Club members can view club books"
  on club_books for select
  to authenticated
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = club_books.club_id
        and club_members.user_id = auth.uid()
    )
  );

create policy "Club owners can manage club books"
  on club_books for insert
  to authenticated
  with check (
    exists (
      select 1 from club_members
      where club_members.club_id = club_books.club_id
        and club_members.user_id = auth.uid()
        and club_members.role = 'owner'
    )
  );

create policy "Club owners can update club books"
  on club_books for update
  to authenticated
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = club_books.club_id
        and club_members.user_id = auth.uid()
        and club_members.role = 'owner'
    )
  );

create index idx_club_books_club on club_books (club_id);
create index idx_club_books_status on club_books (club_id, status);

-- ============================================================
-- USER BOOKS
-- ============================================================
create table user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  shelf text check (shelf in ('reading', 'want', 'read')) not null,
  progress_pct numeric(5,2),
  progress_page int,
  started_at date,
  finished_at date,
  is_favourite boolean default false not null,
  favourite_rank int,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, book_id)
);

alter table user_books enable row level security;

create policy "Users can view own books"
  on user_books for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Club members can view each others books"
  on user_books for select
  to authenticated
  using (
    exists (
      select 1 from club_members cm1
      join club_members cm2 on cm1.club_id = cm2.club_id
      where cm1.user_id = auth.uid()
        and cm2.user_id = user_books.user_id
    )
  );

create policy "Users can insert own books"
  on user_books for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own books"
  on user_books for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own books"
  on user_books for delete
  to authenticated
  using (auth.uid() = user_id);

create index idx_user_books_user on user_books (user_id);
create index idx_user_books_shelf on user_books (user_id, shelf);
create index idx_user_books_favourite on user_books (user_id, is_favourite) where is_favourite = true;

-- ============================================================
-- LOGS
-- ============================================================
create table logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  club_id uuid references clubs on delete set null,
  club_book_id uuid references club_books on delete set null,
  kind text check (kind in ('review', 'shelf_change', 'progress', 'favourite')) not null,
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  review text,
  shelf text,
  progress_pct numeric(5,2),
  created_at timestamptz default now() not null
);

alter table logs enable row level security;

create policy "Users can view own logs"
  on logs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Club members can view club logs"
  on logs for select
  to authenticated
  using (
    club_id is not null
    and exists (
      select 1 from club_members
      where club_members.club_id = logs.club_id
        and club_members.user_id = auth.uid()
    )
  );

create policy "Users can insert own logs"
  on logs for insert
  to authenticated
  with check (auth.uid() = user_id);

create index idx_logs_user on logs (user_id, created_at desc);
create index idx_logs_club on logs (club_id, created_at desc) where club_id is not null;
create index idx_logs_book on logs (book_id);

-- ============================================================
-- QUOTES
-- ============================================================
create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  club_id uuid references clubs on delete set null,
  body text not null,
  page_number int,
  note text,
  created_at timestamptz default now() not null
);

alter table quotes enable row level security;

create policy "Users can view own quotes"
  on quotes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Club members can view club quotes"
  on quotes for select
  to authenticated
  using (
    club_id is not null
    and exists (
      select 1 from club_members
      where club_members.club_id = quotes.club_id
        and club_members.user_id = auth.uid()
    )
  );

create policy "Users can insert own quotes"
  on quotes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own quotes"
  on quotes for delete
  to authenticated
  using (auth.uid() = user_id);

create index idx_quotes_user on quotes (user_id, created_at desc);
create index idx_quotes_book on quotes (book_id);

-- ============================================================
-- CLUB COMMENTS
-- ============================================================
create table club_comments (
  id uuid primary key default gen_random_uuid(),
  club_book_id uuid references club_books on delete cascade not null,
  user_id uuid references profiles on delete cascade not null,
  parent_id uuid references club_comments on delete cascade,
  body text not null,
  created_at timestamptz default now() not null
);

alter table club_comments enable row level security;

create policy "Club members can view comments"
  on club_comments for select
  to authenticated
  using (
    exists (
      select 1 from club_books cb
      join club_members cm on cm.club_id = cb.club_id
      where cb.id = club_comments.club_book_id
        and cm.user_id = auth.uid()
    )
  );

create policy "Club members can insert comments"
  on club_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from club_books cb
      join club_members cm on cm.club_id = cb.club_id
      where cb.id = club_comments.club_book_id
        and cm.user_id = auth.uid()
    )
  );

create policy "Authors can delete own comments"
  on club_comments for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Club owners can delete any comment"
  on club_comments for delete
  to authenticated
  using (
    exists (
      select 1 from club_books cb
      join club_members cm on cm.club_id = cb.club_id
      where cb.id = club_comments.club_book_id
        and cm.user_id = auth.uid()
        and cm.role = 'owner'
    )
  );

create index idx_club_comments_book on club_comments (club_book_id, created_at);

-- ============================================================
-- FUNCTION: Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
