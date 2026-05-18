import Parser from 'rss-parser';
import https from 'https';
import { findAdapter, registerGenericUrl } from './scrapers/index';
import { genericScraper } from './scrapers/generic';

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

  // Follow redirects and re-check adapters — e.g. doordash.engineering
  // redirects to careersatdoordash.com/career-areas/engineering/
  try {
    const resolved = await resolveRedirect(url);
    if (resolved !== url && findAdapter(resolved)) return resolved;
  } catch {}

  // Try the URL directly first
  try {
    await parser.parseURL(url);
    return url;
  } catch {}

  // Parse the HTML page for feed declarations — two passes:
  // 1. <link rel="alternate" type="application/rss+xml"> — the standard
  // 2. Any href containing /feed, /rss, /atom as a fallback for sites
  //    (like Cloudflare's blog) that omit the <link> tag but have a /rss/ path
  try {
    const html = await fetchHtml(url);

    // Pass 1: proper <link rel="alternate"> tags
    const linkRe = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
    const hrefRe = /href=["']([^"']+)["']/i;
    const typeRe = /type=["'](application\/(rss|atom)\+xml)[^"']*["']/i;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(html)) !== null) {
      const tag = match[0];
      if (!typeRe.test(tag)) continue;
      const hrefMatch = hrefRe.exec(tag);
      if (!hrefMatch) continue;
      const feedUrl = new URL(hrefMatch[1], url).href;
      try {
        await parser.parseURL(feedUrl);
        return feedUrl;
      } catch {}
    }

    // Pass 2: any anchor/link href that looks like a feed path
    const allHrefRe = /href=["']([^"']*(?:\/feed|\/rss|\/atom)[^"']*?)["']/gi;
    const feedHrefs = new Set<string>();
    while ((match = allHrefRe.exec(html)) !== null) {
      feedHrefs.add(new URL(match[1], url).href);
    }
    for (const feedUrl of feedHrefs) {
      try {
        await parser.parseURL(feedUrl);
        return feedUrl;
      } catch {}
    }
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
    `${base}/rss/`,
    `${base}/atom.xml`,
    `${base}/index.xml`,
    // Pelican / Jekyll style under /feeds/
    `${base}/feeds/rss.xml`,
    `${base}/feeds/atom.xml`,
    `${base}/feeds/all.rss.xml`,
    `${base}/feeds/all.atom.xml`,
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

  // Last resort: try the generic web scraper for sites without RSS
  try {
    const result = await genericScraper.scrape(url);
    if (result.articles.length >= 1) {
      registerGenericUrl(url);
      return url;  // Return the original URL — fetchFeed will route through generic adapter
    }
  } catch {}

  throw new Error(`Could not find RSS feed for: ${url}`);
}

/** Follow up to 5 redirects and return the final URL. */
async function resolveRedirect(url: string, hops = 0): Promise<string> {
  if (hops > 5) return url;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: httpsAgent, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolveRedirect(new URL(res.headers.location, url).href, hops + 1).then(resolve).catch(reject);
      } else {
        res.resume();
        resolve(url);
      }
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,*/*',
      },
    }, (res) => {
      // Follow a single redirect
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Fetch the favicon for a website and return it as a data URI (base64).
 * Parses the site's HTML for <link rel="icon"> tags, falls back to /favicon.ico.
 * Downloading in the main process avoids CORS / hotlink / redirect issues
 * that break <img> tags in the renderer.
 */
export async function fetchFaviconUrl(siteUrl: string): Promise<string | null> {
  const base = new URL(siteUrl).origin;
  const candidates: string[] = [];

  try {
    const html = await fetchHtml(base);

    // Look for <link rel="icon"> or <link rel="shortcut icon"> or <link rel="apple-touch-icon">
    const linkRe = /<link[^>]+rel=["'](?:shortcut )?(?:icon|apple-touch-icon)["'][^>]*>/gi;
    const hrefRe = /href=["']([^"']+)["']/i;
    const sizesRe = /sizes=["']([^"']+)["']/i;

    const found: { url: string; size: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRe.exec(html)) !== null) {
      const tag = match[0];
      const hrefMatch = hrefRe.exec(tag);
      if (!hrefMatch) continue;

      const href = new URL(hrefMatch[1], base).href;
      const sizesMatch = sizesRe.exec(tag);
      const size = sizesMatch ? parseInt(sizesMatch[1]) || 0 : 16;
      found.push({ url: href, size });
    }

    // Sort by closeness to 32px (crisp at 16px display on Retina)
    found.sort((a, b) => Math.abs(a.size - 32) - Math.abs(b.size - 32));
    candidates.push(...found.map(f => f.url));
  } catch {}

  // Always try /favicon.ico as last resort
  candidates.push(`${base}/favicon.ico`);

  // Try each candidate — download and convert to data URI
  for (const url of candidates) {
    try {
      const dataUri = await downloadAsDataUri(url);
      if (dataUri) return dataUri;
    } catch {}
  }

  return null;
}

/** Download a URL and return its content as a data URI string. */
function downloadAsDataUri(url: string): Promise<string | null> {
  const mod = url.startsWith('https') ? https : require('http');
  return new Promise((resolve) => {
    const req = mod.get(url, {
      agent: url.startsWith('https') ? httpsAgent : undefined,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    }, (res: any) => {
      // Follow redirects (up to 3)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadAsDataUri(new URL(res.headers.location, url).href).then(resolve).catch(() => resolve(null));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }

      // Reject non-image content types early (e.g. HTML error pages)
      const ct = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (ct && ct.startsWith('text/html')) { res.resume(); resolve(null); return; }

      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // Reject empty or suspiciously large responses (>200KB is not a favicon)
        if (buf.length === 0 || buf.length > 200_000) { resolve(null); return; }

        // Detect MIME type from content-type header or file extension
        let mime = ct;
        if (!mime || mime === 'application/octet-stream') {
          if (url.endsWith('.svg')) mime = 'image/svg+xml';
          else if (url.endsWith('.png')) mime = 'image/png';
          else if (url.endsWith('.ico')) mime = 'image/x-icon';
          else mime = 'image/png'; // safe default
        }

        resolve(`data:${mime};base64,${buf.toString('base64')}`);
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
