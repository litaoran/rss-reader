import { ParsedFeed } from '../fetcher';

/**
 * A scraper adapter handles websites that don't publish RSS feeds.
 * Each adapter targets a specific site (or pattern of sites) and
 * returns the same ParsedFeed shape used by the RSS fetcher, so the
 * rest of the app needs no special casing.
 */
export interface ScraperAdapter {
  /** Human-readable name shown in logs */
  name: string;
  /** Return true if this adapter should handle the given URL */
  matches: (url: string) => boolean;
  /** Fetch and parse the page, returning a feed-shaped result */
  scrape: (url: string) => Promise<ParsedFeed>;
}
