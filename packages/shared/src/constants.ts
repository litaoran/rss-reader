/** How long before a feed's "last fetched" is considered stale (7 days). */
export const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/** Background refresh interval (15 minutes). */
export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/** Default feeds seeded on first launch. */
export const DEFAULT_FEEDS = [
  {
    url: 'https://hnrss.org/frontpage',
    name: 'Hacker News',
    folder: 'News',
  },
  {
    url: 'https://blog.cloudflare.com/rss/',
    name: 'Cloudflare Blog',
    folder: 'Big Tech',
  },
  {
    url: 'https://netflixtechblog.com/feed',
    name: 'Netflix Tech Blog',
    folder: 'Big Tech',
  },
  {
    url: 'https://stripe.com/blog/feed.rss',
    name: 'Stripe Engineering',
    folder: 'Big Tech',
  },
  {
    url: 'https://martinfowler.com/feed.atom',
    name: 'Martin Fowler',
    folder: 'Writers',
  },
  {
    url: 'https://newsletter.pragmaticengineer.com/feed',
    name: 'The Pragmatic Engineer',
    folder: 'Writers',
  },
];

/** SQL schema shared between desktop (better-sqlite3) and mobile (expo-sqlite). */
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    folder TEXT,
    lastFetched INTEGER,
    isActive INTEGER NOT NULL DEFAULT 1,
    faviconUrl TEXT,
    folderOrder INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedId INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    author TEXT,
    publishedAt INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    summary TEXT,
    isRead INTEGER NOT NULL DEFAULT 0,
    isStarred INTEGER NOT NULL DEFAULT 0,
    scrollProgress REAL NOT NULL DEFAULT 0,
    readTimeMin INTEGER NOT NULL DEFAULT 1,
    fetchedAt INTEGER NOT NULL,
    UNIQUE(feedId, guid)
  );
`;

/** Strip HTML tags from a string. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Estimate reading time in minutes from plain text. */
export function estimateReadTime(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}
