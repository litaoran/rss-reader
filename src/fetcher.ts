import Parser from 'rss-parser';
import https from 'https';
import http from 'http';

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'description'],
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

  // Try the URL directly first
  try {
    await parser.parseURL(url);
    return url;
  } catch {}

  // Common feed paths to try
  const base = new URL(url).origin;
  const candidates = [
    `${base}/feed`,
    `${base}/feed.xml`,
    `${base}/rss`,
    `${base}/rss.xml`,
    `${base}/atom.xml`,
    `${base}/blog/feed`,
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
