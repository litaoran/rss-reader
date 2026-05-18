import { ScraperAdapter } from './types';
import { uberScraper } from './uber';
import { doordashScraper } from './doordash';
import { genericScraper, registerGenericUrl } from './generic';

/**
 * Registry of all scraper adapters.
 * To add a new site: create src/scrapers/<site>.ts, export a ScraperAdapter,
 * and add it to this array.  Site-specific adapters go BEFORE genericScraper.
 */
const adapters: ScraperAdapter[] = [
  uberScraper,
  doordashScraper,
  genericScraper,  // Must be last — catch-all for sites without RSS
];

/** Returns the first adapter that claims this URL, or null. */
export function findAdapter(url: string): ScraperAdapter | null {
  return adapters.find(a => a.matches(url)) ?? null;
}

export { registerGenericUrl };
