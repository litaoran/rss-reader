import { stripHtml, estimateReadTime, type ParsedArticle, type ParsedFeed } from '@antenna/shared';

/**
 * Fetch and parse an RSS/Atom feed using the native fetch API.
 * Unlike the desktop version (which uses rss-parser + Node https),
 * this uses a lightweight XML parser suitable for React Native.
 */
export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Antenna/1.0 (iOS)',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  return parseXml(xml, url);
}

/**
 * Minimal RSS/Atom XML parser.
 * Handles RSS 2.0 and Atom feeds without a heavy XML library.
 */
function parseXml(xml: string, feedUrl: string): ParsedFeed {
  const isAtom = /<feed[\s>]/i.test(xml);
  const feedName = extractTag(xml, isAtom ? 'title' : 'title') || new URL(feedUrl).hostname;

  const items = isAtom ? extractAtomEntries(xml) : extractRssItems(xml);
  const articles: ParsedArticle[] = items.map(item => {
    const content = item.content || item.description || '';
    const summary = item.summary || null;
    const text = stripHtml(content || summary || '');
    const readTimeMin = estimateReadTime(text);

    // Clean summary: strip HTML tags, decode entities, truncate
    const cleanSummary = summary ? stripHtml(summary).slice(0, 300) : null;

    return {
      guid: item.guid || item.link || item.title || String(Date.now()),
      title: decodeEntities(item.title || 'Untitled'),
      url: item.link || feedUrl,
      author: item.author || null,
      publishedAt: item.published ? new Date(item.published).getTime() : Date.now(),
      content,
      summary: cleanSummary,
      readTimeMin,
    };
  });

  return { name: feedName, articles };
}

interface RawItem {
  guid?: string;
  title?: string;
  link?: string;
  author?: string;
  published?: string;
  content?: string;
  description?: string;
  summary?: string;
}

function extractRssItems(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      guid: extractTag(block, 'guid') || undefined,
      title: decodeEntities(extractTag(block, 'title') || ''),
      link: extractTag(block, 'link') || undefined,
      author: extractTag(block, 'dc:creator') || extractTag(block, 'author') || undefined,
      published: extractTag(block, 'pubDate') || undefined,
      content: extractCdata(block, 'content:encoded') || extractTag(block, 'content:encoded') || undefined,
      description: extractCdata(block, 'description') || extractTag(block, 'description') || undefined,
      summary: extractTag(block, 'description') || undefined,
    });
  }
  return items;
}

function extractAtomEntries(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const linkMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
    items.push({
      guid: extractTag(block, 'id') || undefined,
      title: decodeEntities(extractTag(block, 'title') || ''),
      link: linkMatch?.[1] || undefined,
      author: extractTag(block, 'name') || undefined,
      published: extractTag(block, 'published') || extractTag(block, 'updated') || undefined,
      content: extractCdata(block, 'content') || extractTag(block, 'content') || undefined,
      summary: extractTag(block, 'summary') || undefined,
    });
  }
  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return null;
  let val = match[1].trim();
  // Strip CDATA wrapper if present
  const cdataMatch = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(val);
  if (cdataMatch) val = cdataMatch[1];
  return val;
}

function extractCdata(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
