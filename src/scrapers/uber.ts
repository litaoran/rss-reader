import { ScraperAdapter, ScrapedArticle } from './types';
import { scrapeWithBrowser } from './browser';
import { ParsedFeed } from '../fetcher';

// JS executed inside the hidden BrowserWindow after the page renders.
// Tries several selector patterns so it stays robust across minor redesigns.
const EXTRACT_JS = `
(() => {
  const results = [];
  const seen = new Set();

  // Walk all anchors that look like blog post links
  const anchors = Array.from(document.querySelectorAll('a[href*="/blog/"]'));
  anchors.forEach(a => {
    const href = a.href;
    // Skip category/pagination links — real posts have deeper paths
    const pathParts = new URL(href).pathname.replace(/\\/$/, '').split('/').filter(Boolean);
    if (pathParts.length < 4) return;
    if (seen.has(href)) return;
    seen.add(href);

    // Walk up to find a card-like container with more metadata
    let el = a;
    for (let i = 0; i < 6; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      if (el.querySelectorAll('a[href*="/blog/"]').length === 1) break;
    }

    const title =
      el.querySelector('h1, h2, h3, h4, [class*="title"], [class*="headline"]')?.textContent?.trim()
      || a.textContent?.trim();

    const dateEl = el.querySelector('time, [class*="date"], [class*="publish"]');
    const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

    const summary = el.querySelector(
      'p, [class*="summary"], [class*="excerpt"], [class*="description"]'
    )?.textContent?.trim();

    const author = el.querySelector('[class*="author"], [rel="author"]')?.textContent?.trim();

    if (title && title.length > 5) {
      results.push({ title, url: href, date, summary, author });
    }
  });

  return results;
})()
`;

export const uberScraper: ScraperAdapter = {
  name: 'Uber Engineering Blog',

  matches: (url) => /uber\.com.*\/blog\/engineering/.test(url),

  async scrape(url): Promise<ParsedFeed> {
    const raw = await scrapeWithBrowser<ScrapedArticle[]>(url, EXTRACT_JS, { waitMs: 3000 });

    const articles = raw.map((item) => {
      const publishedAt = item.date ? new Date(item.date).getTime() : Date.now();
      const wordCount = (item.summary || '').split(/\s+/).length;
      return {
        guid: item.url,
        title: item.title,
        url: item.url,
        author: item.author || null,
        publishedAt: isNaN(publishedAt) ? Date.now() : publishedAt,
        content: item.summary || '',
        summary: item.summary ? item.summary.slice(0, 500) : null,
        readTimeMin: Math.max(1, Math.ceil(wordCount / 200)),
      };
    });

    return { name: 'Uber Engineering', articles };
  },
};
