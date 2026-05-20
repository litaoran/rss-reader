import { ScraperAdapter } from './types';
import { scrapeWithBrowser, ScrapedArticle } from './browser';
import { ParsedFeed } from '../fetcher';

/**
 * URLs that have been validated as scrapable (no RSS feed available).
 * Populated by discoverFeedUrl() when RSS discovery fails but the
 * generic scraper finds articles.  findAdapter() then matches these
 * so fetchFeed() routes through the scraper on subsequent refreshes.
 */
const scrapableUrls = new Set<string>();

export function registerGenericUrl(url: string) {
  scrapableUrls.add(normalizeUrl(url));
}

export function isGenericUrl(url: string): boolean {
  return scrapableUrls.has(normalizeUrl(url));
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Extraction JS — runs inside a hidden BrowserWindow after the page renders.
//
// Four strategies, tried in priority order:
//   1. JSON-LD structured data (BlogPosting, Article, NewsArticle)
//   2. <article> tags with links + headings
//   3. Heading-inside-link card heuristic (most common blog layout)
//   4. OG / meta fallback for single-article pages
// ---------------------------------------------------------------------------

const EXTRACT_LIST_JS = `
(() => {
  const results = [];
  const seen = new Set();
  const pageOrigin = location.origin;
  const pagePath = location.pathname.replace(/\\/$/, '');

  // ---- helpers ----
  function addResult(title, url, date, author, summary) {
    if (!title || !url) return;
    title = title.trim();
    if (title.length < 8) return;
    try { url = new URL(url, location.href).href; } catch { return; }
    const u = new URL(url);
    // Must be same origin (or closely related subdomain)
    if (u.origin !== pageOrigin &&
        !u.hostname.endsWith('.' + location.hostname) &&
        !location.hostname.endsWith('.' + u.hostname)) return;
    // Skip links back to the listing page itself
    if (u.pathname.replace(/\\/$/, '') === pagePath) return;
    // Skip common non-article paths
    if (/^\\/(about|contact|tag|tags|category|categories|page|author|search|login|signup|privacy|terms|careers|press)(\\b|\\/|$)/i.test(u.pathname)) return;
    // Skip anchors-only, javascript:, mailto:
    if (url.startsWith('javascript:') || url.startsWith('mailto:')) return;

    const key = u.origin + u.pathname.replace(/\\/$/, '');
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      title,
      url,
      date: date || null,
      author: author || null,
      summary: summary ? summary.trim().slice(0, 600) : null,
    });
  }

  function extractDate(el) {
    const time = el.querySelector('time[datetime]');
    if (time) return time.getAttribute('datetime');
    const time2 = el.querySelector('time');
    if (time2) return time2.textContent;
    const dateEl = el.querySelector('[class*="date"], [class*="publish"], [class*="Date"], [class*="time"]');
    if (dateEl) return dateEl.textContent;
    return null;
  }

  function extractSummary(el) {
    // Look for a paragraph that isn't the title
    const ps = el.querySelectorAll('p, [class*="summary"], [class*="excerpt"], [class*="description"], [class*="snippet"]');
    for (const p of ps) {
      const text = p.textContent?.trim();
      if (text && text.length > 20 && text.length < 2000) return text;
    }
    return null;
  }

  function extractAuthor(el) {
    const a = el.querySelector('[class*="author"], [rel="author"], [class*="byline"]');
    return a ? a.textContent?.trim() : null;
  }

  // ---- Strategy 1: JSON-LD ----
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      let data = JSON.parse(el.textContent);
      if (Array.isArray(data)) data = data[0];

      // Handle @graph arrays
      const items = data['@graph'] || (data.itemListElement) || [];
      const candidates = items.length > 0 ? items : [data];

      for (let item of candidates) {
        if (item.item) item = item.item; // itemListElement wrapper
        const type = item['@type'];
        if (!type) continue;
        const types = Array.isArray(type) ? type : [type];
        if (!types.some(t => /Article|BlogPosting|NewsArticle|WebPage|CreativeWork/i.test(t))) continue;

        addResult(
          item.headline || item.name,
          item.url || item.mainEntityOfPage,
          item.datePublished || item.dateCreated,
          item.author?.name || (Array.isArray(item.author) ? item.author[0]?.name : null),
          item.description || item.abstract
        );
      }
    } catch {}
  }
  if (results.length >= 3) return { articles: results, siteName: document.querySelector('meta[property="og:site_name"]')?.content || document.title };

  // ---- Strategy 2: <article> tags ----
  for (const article of document.querySelectorAll('article')) {
    // Link can be a child (article > a) or parent (a > article)
    let link = article.querySelector('a[href]');
    if (!link) {
      const parentLink = article.closest('a[href]');
      if (parentLink) link = parentLink;
    }
    if (!link) continue;
    // Title: heading > first substantial <p> > link text
    const heading = article.querySelector('h1, h2, h3, h4');
    let title = heading?.textContent;
    if (!title) {
      for (const p of article.querySelectorAll('p')) {
        const t = p.textContent?.trim();
        if (t && t.length >= 10 && t.length < 300) { title = t; break; }
      }
    }
    if (!title) title = link.textContent?.trim().split('\\n')[0];
    addResult(title, link.href, extractDate(article), extractAuthor(article), extractSummary(article));
  }
  if (results.length >= 3) return { articles: results, siteName: document.querySelector('meta[property="og:site_name"]')?.content || document.title };

  // ---- Strategy 3: Heading+link card detection ----
  // Find all links that contain headings, or headings that contain links
  const candidateLinks = new Map(); // href -> {link, heading}
  document.querySelectorAll('a[href]').forEach(a => {
    const h = a.querySelector('h1, h2, h3, h4, h5');
    if (h && h.textContent.trim().length >= 8) {
      candidateLinks.set(a.href, { link: a, heading: h });
    }
  });
  // Also check headings that contain links
  document.querySelectorAll('h1 a[href], h2 a[href], h3 a[href], h4 a[href], h5 a[href]').forEach(a => {
    const h = a.closest('h1, h2, h3, h4, h5');
    if (h && h.textContent.trim().length >= 8 && !candidateLinks.has(a.href)) {
      candidateLinks.set(a.href, { link: a, heading: h });
    }
  });

  for (const [href, { link, heading }] of candidateLinks) {
    // Walk up to find the card container
    let el = link;
    for (let i = 0; i < 8; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      // Stop at a reasonable card boundary
      if (el.tagName === 'LI' || el.tagName === 'ARTICLE' ||
          el.tagName === 'SECTION' || el.tagName === 'DIV') {
        const innerLinks = el.querySelectorAll('a[href]');
        const uniqueHrefs = new Set(Array.from(innerLinks).map(l => { try { return new URL(l.href).pathname; } catch { return ''; } }));
        if (uniqueHrefs.size <= 3) break; // Found a card-level container
      }
    }

    addResult(
      heading.textContent,
      href,
      extractDate(el),
      extractAuthor(el),
      extractSummary(el)
    );
  }
  if (results.length >= 2) return { articles: results, siteName: document.querySelector('meta[property="og:site_name"]')?.content || document.title };

  // ---- Strategy 3b: Link cards with <time> elements ----
  // Many modern sites (e.g. OpenAI) use div-based card layouts without
  // headings or <article> tags.  A strong article signal is a link that
  // contains (or whose parent contains) a <time> element.
  document.querySelectorAll('a[href]').forEach(a => {
    // Look for a <time> inside the link or in its immediate parent card
    let card = a;
    let time = a.querySelector('time');
    if (!time) {
      // Walk up a couple levels to find a card wrapper with a <time>
      for (let p = a.parentElement, i = 0; p && i < 3; p = p.parentElement, i++) {
        time = p.querySelector('time');
        if (time) { card = p; break; }
      }
    }
    if (!time) return;

    // The link must point to something that looks like an article path
    // (more than just "/" or a short path like "/news/")
    try {
      const u = new URL(a.href);
      const segments = u.pathname.replace(/\\/$/, '').split('/').filter(Boolean);
      if (segments.length < 2) return;  // Too short — likely a category page
    } catch { return; }

    // Extract the best title text — first substantial div/span text in the link
    let title = '';
    if (a.querySelector('h1, h2, h3, h4, h5')) {
      title = a.querySelector('h1, h2, h3, h4, h5').textContent;
    } else {
      // Find the first text-heavy child (skip category labels and dates)
      for (const child of a.querySelectorAll('div, span, p')) {
        const t = child.textContent?.trim();
        if (t && t.length >= 15 && t.length < 300 && !child.querySelector('time')) {
          title = t;
          break;
        }
      }
    }
    if (!title) title = a.textContent?.trim().split('\\n')[0];

    const dateStr = time.getAttribute('datetime') || time.textContent;
    addResult(title, a.href, dateStr, extractAuthor(card), extractSummary(card));
  });
  if (results.length >= 2) return { articles: results, siteName: document.querySelector('meta[property="og:site_name"]')?.content || document.title };

  // ---- Strategy 4: OG meta single-article fallback ----
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  const ogUrl = document.querySelector('meta[property="og:url"]')?.content;
  const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
  const ogDate = document.querySelector('meta[property="article:published_time"]')?.content;
  if (ogTitle && ogUrl) {
    addResult(ogTitle, ogUrl, ogDate, null, ogDesc);
  }

  return {
    articles: results,
    siteName: document.querySelector('meta[property="og:site_name"]')?.content || document.title,
  };
})()
`;

export const genericScraper: ScraperAdapter = {
  name: 'Generic Web Scraper',

  matches: (url) => isGenericUrl(url),

  async scrape(url): Promise<ParsedFeed> {
    const raw = await scrapeWithBrowser<{ articles: ScrapedArticle[]; siteName: string }>(
      url, EXTRACT_LIST_JS, { waitMs: 3000 }
    );

    const articles = (raw.articles || []).slice(0, 50).map((item) => {
      let publishedAt = 0;
      if (item.date) {
        const ts = new Date(item.date).getTime();
        if (!isNaN(ts) && ts > 0) publishedAt = ts;
      }
      const wordCount = (item.summary || '').split(/\s+/).length;
      return {
        guid: item.url,
        title: item.title,
        url: item.url,
        author: item.author || null,
        publishedAt,
        content: '',  // Leave empty — full content is fetched on demand when opened
        summary: item.summary ? item.summary.slice(0, 500) : null,
        readTimeMin: Math.max(1, Math.ceil(wordCount / 200)),
      };
    });

    // Derive feed name from site name, cleaning up common suffixes
    let name = raw.siteName || new URL(url).hostname;
    name = name.replace(/\s*[|–—-]\s*$/, '').trim();
    if (!name) name = new URL(url).hostname;

    return { name, articles };
  },
};
