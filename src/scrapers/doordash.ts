import { ScraperAdapter } from './types';
import { scrapeWithBrowser, ScrapedArticle } from './browser';
import { ParsedFeed } from '../fetcher';
import { EXTRACT_ARTICLE_CONTENT_JS } from './uber';

// Article URLs: https://careersatdoordash.com/blog/<slug>/
// Listing page:  https://careersatdoordash.com/career-areas/engineering/
const EXTRACT_LIST_JS = `
(() => {
  const results = [];
  const seen = new Set();

  const anchors = Array.from(document.querySelectorAll('a[href]'));
  anchors.forEach(a => {
    let href;
    try { href = new URL(a.href).href; } catch { return; }

    if (!/careersatdoordash\\.com/.test(href)) return;

    const pathname = new URL(href).pathname.replace(/\\/$/, '');
    const parts = pathname.split('/').filter(Boolean);

    // Pattern: /blog/<slug>
    if (parts.length !== 2 || parts[0] !== 'blog') return;
    const slug = parts[1];
    if (slug.length < 10 || !/[a-z].*-.*[a-z]/.test(slug)) return;

    if (seen.has(href)) return;
    seen.add(href);

    // Walk up to find the card container for this article
    let el = a;
    for (let i = 0; i < 8; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      const articleLinks = Array.from(el.querySelectorAll('a[href]'))
        .filter(x => {
          try {
            const p = new URL(x.href).pathname.replace(/\\/$/, '').split('/').filter(Boolean);
            return p.length === 2 && p[0] === 'blog' && p[1].length >= 10 && /[a-z].*-.*[a-z]/.test(p[1]);
          } catch { return false; }
        });
      if (articleLinks.length === 1) break;
    }

    const title =
      el.querySelector('h1, h2, h3, h4, [class*="title"], [class*="headline"]')?.textContent?.trim()
      || a.textContent?.trim();

    if (!title || title.length < 8) return;

    const dateEl = el.querySelector('time, [class*="date"], [class*="publish"]');
    const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();
    const summary = el.querySelector('p, [class*="summary"], [class*="excerpt"], [class*="description"]')?.textContent?.trim();
    const author = el.querySelector('[class*="author"], [rel="author"]')?.textContent?.trim();

    results.push({ title, url: href, date, summary, author });
  });

  return results;
})()
`;

export const doordashScraper: ScraperAdapter = {
  name: 'DoorDash Engineering Blog',

  matches: (url) => /careersatdoordash\.com.*\/career-areas\/engineering/.test(url),

  async scrape(url): Promise<ParsedFeed> {
    const raw = await scrapeWithBrowser<ScrapedArticle[]>(url, EXTRACT_LIST_JS, { waitMs: 4000 });

    const articles = raw.map((item) => {
      const publishedAt = item.date ? new Date(item.date).getTime() : Date.now();
      const wordCount = (item.summary || '').split(/\s+/).length;
      return {
        guid: item.url,
        title: item.title,
        url: item.url,
        author: item.author || null,
        publishedAt: isNaN(publishedAt) ? 0 : publishedAt,
        content: item.summary || '',
        summary: item.summary ? item.summary.slice(0, 500) : null,
        readTimeMin: Math.max(1, Math.ceil(wordCount / 200)),
      };
    });

    return { name: 'DoorDash Engineering', articles };
  },
};
