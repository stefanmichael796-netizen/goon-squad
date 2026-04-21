# Goon Squad

> "Time's a goon, right?"

A lightweight, social reading tracker. Letterboxd for books, but deliberately slower and quieter. Track what you read, share it with your book club, and slowly build a picture of your reading taste over time.

Named after Jennifer Egan's *A Visit from the Goon Squad*; the goon is time, and the app is for tracking what you read before it slips past.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend / DB / Auth**: Supabase (Postgres + Row Level Security + Auth)
- **Book metadata**: Google Books API
- **Charts**: Recharts
- **Hosting target**: Vercel frontend + Supabase cloud

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A Supabase project
- A Google Books API key (optional but recommended)

### 1. Clone and install

```bash
git clone <repo-url>
cd goon-squad
pnpm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your project URL and anon key
3. Go to **Settings > API** and copy the service role key (keep this secret)

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
```

### 4. Run migrations

In the Supabase SQL Editor, run the contents of:

```
supabase/migrations/00001_initial_schema.sql
```

This creates all tables, indexes, RLS policies, and the auto-profile trigger.

### 5. Enable Google OAuth (optional)

1. In the Google Cloud Console, create OAuth 2.0 credentials
2. Set the authorized redirect URI to: `https://your-project.supabase.co/auth/v1/callback`
3. In Supabase, go to **Authentication > Providers > Google** and enter your client ID and secret

### 6. Seed data (optional)

If you want demo data:

1. Create two test users via the Supabase Auth dashboard or signup flow
2. Update the UUIDs in `supabase/seed.sql` to match your user IDs
3. Run the seed script in the SQL Editor

### 7. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 8. Get a Google Books API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Books API**
3. Create an API key under **Credentials**
4. Add it to your `.env.local` as `GOOGLE_BOOKS_API_KEY`

Book search works without a key but has stricter rate limits.

## Deploying to Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Set the environment variables in Vercel's project settings
4. Deploy

## Project Structure

```
src/
  app/
    (main)/          # Route group for authenticated pages with bottom nav
      personal/      # Personal tab (shelves, favourites, quotes, feed)
      club/          # Club tab (header, feed, discussion, members)
      book/[id]/     # Book detail page
      insights/      # Reading insights and year-in-review
    api/             # API routes (books, log, quote, club, insights)
    auth/            # Auth callback
    login/           # Login page
    signup/          # Signup page
    onboarding/      # Profile setup and club creation/join
  components/
    shared/          # Cross-cutting components (bottom nav, log sheet, FAB)
    ui/              # Reusable UI primitives (book cover, star rating, etc.)
  lib/
    supabase/        # Supabase client (browser, server, middleware)
    google-books.ts  # Google Books API wrapper
    types.ts         # TypeScript types
    utils.ts         # Utility functions
supabase/
  migrations/        # SQL migration files
  seed.sql           # Demo data
```
