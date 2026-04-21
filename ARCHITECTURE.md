# Architecture

## The Shared Log Design

The most important architectural decision in Goon Squad is the shared data layer between the Personal and Club tabs.

### How it works

When a user logs a book, a single `logs` row is created. The `club_id` column determines visibility:

- **`club_id = NULL`**: The log is personal-only. It appears in the user's Personal activity feed but not in any club feed.
- **`club_id = <uuid>`**: The log is shared with the club. It appears in both the user's Personal feed and the club's activity feed.

This means logging happens once. The UI presents two views of the same data, filtered by `club_id`.

### Why `logs.club_id` is nullable

A nullable `club_id` is the simplest way to express "personal vs. shared" without duplicating rows or maintaining a separate table. RLS policies use this column directly:

```sql
-- Personal: user can always see their own logs
policy "Users can view own logs" on logs
  using (auth.uid() = user_id);

-- Club: club members can see logs shared with their club
policy "Club members can view club logs" on logs
  using (
    club_id is not null
    and exists (select 1 from club_members where ...)
  );
```

### The `club_book_id` link

When a logged book matches a current or past club pick, `club_book_id` links the log to the specific `club_books` entry. This enables:

- Showing the log in the club book's discussion context
- Aggregating progress across members for the "current read" card

If the user shares a book to the club that isn't a club pick, `club_book_id` is null but `club_id` is set. The log still appears in the club feed.

### User books and shelves

The `user_books` table tracks the user's shelf state for each book. When a book is logged through the club, the shelf state is still updated on the user's personal `user_books` row. The club doesn't have its own shelf concept; it has `club_books` for picks and `club_comments` for discussion.

## RLS Model

Row Level Security enforces all access control at the database level:

- **Profiles**: Readable by all authenticated users (needed for member lists, activity feeds). Writable only by the owner.
- **Books**: Readable and insertable by all authenticated users. Books are shared reference data.
- **User books**: Readable by the owner and by members of any shared club. Writable only by the owner.
- **Logs and Quotes**: Readable by the owner always. If `club_id` is set, also readable by members of that club. Writable only by the owner.
- **Clubs**: Readable by members. Writable (update) by the club owner.
- **Club books**: Readable by members. Manageable by the club owner.
- **Club comments**: Readable by club members. Insertable by club members. Deletable by the author or the club owner.
- **Club members**: Readable by fellow club members. Users can insert (join) or delete (leave) their own membership.

## Data Flow: Logging a Book

1. User searches Google Books via `/api/books/search`
2. User fills in rating, review, shelf, and optional club share
3. `POST /api/log` handler:
   a. Upserts the book into `books` (deduped by `google_books_id`)
   b. Upserts the user's shelf state in `user_books`
   c. Creates a `logs` row with `club_id` set if sharing to club
   d. If the book matches a club pick, links via `club_book_id`
4. Both Personal and Club feeds pick up the new log via their respective queries

## Multi-Club Support

The data model supports multiple clubs per user. The UI currently shows only the user's first club. To support multiple clubs:

1. Add a club selector to the UI
2. Store the selected club in client state or URL
3. All queries already accept a `club_id` parameter

No schema changes needed.
