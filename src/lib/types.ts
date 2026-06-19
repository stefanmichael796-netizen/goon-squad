export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  google_books_id: string;
  title: string;
  authors: string[];
  author_countries: string[] | null;
  cover_url: string | null;
  isbn_13: string | null;
  page_count: number | null;
  categories: string[] | null;
  published_date: string | null;
  publisher: string | null;
  description: string | null;
  created_at: string;
}

export interface UserBook {
  id: string;
  user_id: string;
  book_id: string;
  shelf: 'reading' | 'want' | 'read';
  progress_pct: number | null;
  progress_page: number | null;
  started_at: string | null;
  finished_at: string | null;
  is_favourite: boolean;
  favourite_rank: number | null;
  created_at: string;
  updated_at: string;
  book?: Book;
}

export interface Log {
  id: string;
  user_id: string;
  book_id: string;
  club_id: string | null;
  club_book_id: string | null;
  kind: 'review' | 'shelf_change' | 'progress' | 'favourite' | 'reread' | 'note';
  rating: number | null;
  review: string | null;
  shelf: string | null;
  progress_pct: number | null;
  created_at: string;
  book?: Book;
  profile?: Profile;
}

export interface Quote {
  id: string;
  user_id: string;
  book_id: string;
  club_id: string | null;
  body: string;
  page_number: number | null;
  note: string | null;
  created_at: string;
  book?: Book;
  profile?: Profile;
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  logo_url: string | null;
  created_at: string;
}

export interface ClubMember {
  club_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: Profile;
}

export interface ClubBook {
  id: string;
  club_id: string;
  book_id: string;
  status: 'current' | 'past' | 'upcoming';
  started_on: string | null;
  ended_on: string | null;
  target_end_date: string | null;
  book?: Book;
}

export interface ClubComment {
  id: string;
  club_book_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profile?: Profile;
  replies?: ClubComment[];
}

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}
