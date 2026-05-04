import Parser from 'rss-parser';
import https from 'https';
import { findAdapter } from './scrapers/index';

// Some feeds (e.g. Netflix Tech Blog) use intermediate CAs not in Node's
// default bundle. For an RSS reader fetching public content this is fine.
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'description'],
  },
  requestOptions: {
    agent: httpsAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
    },
  },
});

export interface ParsedArticle {
  guid: string;
  title: string;
  url: string;
  author: string | null;
  publishedAt: number;
  content: string;
  summary: string | null;
  readTimeMin: number;
}

export interface ParsedFeed {
  name: string;
  articles: ParsedArticle[];
}

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const adapter = findAdapter(url);
  if (adapter) return adapter.scrape(url);

  const feed = await parser.parseURL(url);
  const articles: ParsedArticle[] = (feed.items || []).map(item => {
    const content = (item as any)['content:encoded'] || item.content || item.description || '';
    const summary = item.contentSnippet || item.summary || null;
    const text = stripHtml(content || summary || '');
    const readTimeMin = Math.max(1, Math.ceil(text.split(/\s+/).length / 200));

    return {
      guid: item.guid || item.link || item.title || String(Date.now()),
      title: item.title || 'Untitled',
      url: item.link || url,
      author: (item as any).creator || (item as any).author || null,
      publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      content,
      summary: summary ? summary.slice(0, 500) : null,
      readTimeMin,
    };
  });

  return {
    name: feed.title || new URL(url).hostname,
    articles,
  };
}

export async function discoverFeedUrl(rawUrl: string): Promise<string> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  // Check scraper adapters first — these handle sites with no RSS feed
  if (findAdapter(url)) return url;

  // Try the URL directly first
  try {
    await parser.parseURL(url);
    return url;
  } catch {}

  // Common feed paths to try — root-level and blog-subdirectory variants
  const base = new URL(url).origin;
  const path = new URL(url).pathname.replace(/\/$/, ''); // e.g. "/blog"
  const candidates = [
    // Root-level
    `${base}/feed`,
    `${base}/feed.xml`,
    `${base}/feed.atom`,
    `${base}/rss`,
    `${base}/rss.xml`,
    `${base}/atom.xml`,
    `${base}/index.xml`,
    // Path-relative (e.g. https://go.dev/blog → tries /blog/feed.atom)
    ...(path ? [
      `${base}${path}/feed`,
      `${base}${path}/feed.xml`,
      `${base}${path}/feed.atom`,
      `${base}${path}/rss`,
      `${base}${path}/rss.xml`,
      `${base}${path}/atom.xml`,
      `${base}${path}/index.xml`,
    ] : []),
    // Blogger / legacy
    `${base}/feeds/posts/default`,
  ];

  for (const candidate of candidates) {
    try {
      await parser.parseURL(candidate);
      return candidate;
    } catch {}
  }

  throw new Error(`Could not find RSS feed for: ${url}`);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
