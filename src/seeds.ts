import { listFeeds, addFeed, updateFeedLastFetched, upsertArticles } from './db';
import { fetchFeed } from './fetcher';

const DEFAULT_FEEDS = [
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
    url: 'https://stripe.com/blog/engineering.rss',
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

export async function seedDefaultFeeds(
  onProgress?: (name: string, done: number, total: number) => void
): Promise<void> {
  // Only seed if the library is empty
  if (listFeeds().length > 0) return;

  const total = DEFAULT_FEEDS.length;
  for (let i = 0; i < total; i++) {
    const { url, name, folder } = DEFAULT_FEEDS[i];
    onProgress?.(name, i, total);
    const feed = addFeed(url, name, folder);
    try {
      const parsed = await fetchFeed(url);
      upsertArticles(feed.id, parsed.articles);
      updateFeedLastFetched(feed.id);
    } catch (e) {
      console.error(`Seed fetch failed for ${name}:`, e);
    }
  }
}
