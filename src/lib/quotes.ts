export interface DisplayQuote {
  body: string;
  bookTitle?: string | null;
  author?: string | null;
  person?: string | null; // who saved it (club view)
}

// Famous public-domain-ish literary lines, used before sign-in and as a fallback
// anywhere the reader hasn't saved quotes of their own yet.
export const CURATED_QUOTES: DisplayQuote[] = [
  { body: "It was the best of times, it was the worst of times.", author: "Charles Dickens", bookTitle: "A Tale of Two Cities" },
  { body: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", author: "Jane Austen", bookTitle: "Pride and Prejudice" },
  { body: "All happy families are alike; each unhappy family is unhappy in its own way.", author: "Leo Tolstoy", bookTitle: "Anna Karenina" },
  { body: "So we beat on, boats against the current, borne back ceaselessly into the past.", author: "F. Scott Fitzgerald", bookTitle: "The Great Gatsby" },
  { body: "Not all those who wander are lost.", author: "J.R.R. Tolkien", bookTitle: "The Fellowship of the Ring" },
  { body: "Whatever our souls are made of, his and mine are the same.", author: "Emily Brontë", bookTitle: "Wuthering Heights" },
  { body: "We are all in the gutter, but some of us are looking at the stars.", author: "Oscar Wilde", bookTitle: "Lady Windermere's Fan" },
  { body: "It is only with the heart that one can see rightly; what is essential is invisible to the eye.", author: "Antoine de Saint-Exupéry", bookTitle: "The Little Prince" },
  { body: "The world breaks everyone, and afterward many are strong at the broken places.", author: "Ernest Hemingway", bookTitle: "A Farewell to Arms" },
  { body: "Until I feared I would lose it, I never loved to read. One does not love breathing.", author: "Harper Lee", bookTitle: "To Kill a Mockingbird" },
  { body: "I took a deep breath and listened to the old brag of my heart. I am, I am, I am.", author: "Sylvia Plath", bookTitle: "The Bell Jar" },
  { body: "Tomorrow is always fresh, with no mistakes in it yet.", author: "L.M. Montgomery", bookTitle: "Anne of Green Gables" },
  { body: "Beware; for I am fearless, and therefore powerful.", author: "Mary Shelley", bookTitle: "Frankenstein" },
  { body: "There is no friend as loyal as a book.", author: "Ernest Hemingway" },
  { body: "Call me Ishmael.", author: "Herman Melville", bookTitle: "Moby-Dick" },
  { body: "It does not do to dwell on dreams and forget to live.", author: "J.K. Rowling", bookTitle: "Harry Potter and the Philosopher's Stone" },
];

export function pickRandom<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

const CACHE_PREFIX = "gs_quotes_v1_";

export function cacheQuotes(scope: string, quotes: DisplayQuote[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + scope, JSON.stringify(quotes.slice(0, 60)));
  } catch {}
}

export function readCachedQuotes(scope: string): DisplayQuote[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + scope);
    if (raw) return JSON.parse(raw) as DisplayQuote[];
  } catch {}
  return [];
}
