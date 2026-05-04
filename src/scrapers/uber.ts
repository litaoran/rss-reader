import { ScraperAdapter } from './types';
import { scrapeWithBrowser, ScrapedArticle } from './browser';
import { ParsedFeed } from '../fetcher';

// JS executed inside the hidden BrowserWindow after the page renders.
const EXTRACT_LIST_JS = `
(() => {
  const results = [];
  const seen = new Set();

  const anchors = Array.from(document.querySelectorAll('a[href*="/blog/engineering/"]'));
  anchors.forEach(a => {
    const href = a.href;
    const pathname = new URL(href).pathname.replace(/\\/$/, '');
    const parts = pathname.split('/').filter(Boolean);

    // Must have a slug after /blog/engineering/ — skip category & pagination pages
    const engIdx = parts.indexOf('engineering');
    if (engIdx === -1 || parts.length <= engIdx + 1) return;
    // Skip known non-article paths
    if (['page', 'pubs', 'web', 'security', 'data', 'mobile', 'backend',
         'culture', 'uber-ai', 'aarhus'].includes(parts[engIdx + 1])) return;
    if (seen.has(href)) return;
    seen.add(href);

    // Walk up to find a card container
    let el = a;
    for (let i = 0; i < 8; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      if (el.querySelectorAll('a[href*="/blog/engineering/"]').length === 1) break;
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

// JS run inside a loaded article page to extract its main content HTML.
export const EXTRACT_ARTICLE_CONTENT_JS = `
(() => {
  // Remove clutter before extracting
  ['script','style','nav','footer','header','aside',
   '[role="navigation"]','[role="banner"]','[role="complementary"]',
   '[class*="related"]','[class*="recommend"]','[class*="sidebar"]',
   '[class*="newsletter"]','[class*="subscribe"]','[class*="comment"]',
   '[class*="cookie"]','[class*="banner"]'
  ].forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));

  const article =
    document.querySelector('article') ||
    document.querySelector('[class*="article-body"]') ||
    document.querySelector('[class*="post-content"]') ||
    document.querySelector('[class*="blog-content"]') ||
    document.querySelector('main');

  return article ? article.innerHTML : '';
})()
`;

export const uberScraper: ScraperAdapter = {
  name: 'Uber Engineering Blog',

  matches: (url) => /uber\.com.*\/blog\/engineering/.test(url),

  async scrape(url): Promise<ParsedFeed> {
    const raw = await scrapeWithBrowser<ScrapedArticle[]>(url, EXTRACT_LIST_JS, { waitMs: 3000 });

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
