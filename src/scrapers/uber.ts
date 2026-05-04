import { ScraperAdapter } from './types';
import { scrapeWithBrowser, ScrapedArticle } from './browser';
import { ParsedFeed } from '../fetcher';

// Non-article path segments that appear directly under /blog/ — used to skip
// navigation links, category pages, and other hub URLs.
const NON_ARTICLE_SLUGS = `
  engineering, newsroom, business, driver, earner, rider, eats, freight,
  health, safety, sustainability, community, culture, product, tech,
  us, en, blog
`.trim();

// JS executed inside the hidden BrowserWindow after the page renders.
// Real Uber Engineering article URLs look like:
//   https://www.uber.com/us/en/blog/ansible-automation-powers/
// They sit directly under /blog/, NOT under /blog/engineering/.
const EXTRACT_LIST_JS = `
(() => {
  const NON_ARTICLE = new Set(${JSON.stringify(
    NON_ARTICLE_SLUGS.split(',').map(s => s.trim()).filter(Boolean)
  )});

  const results = [];
  const seen = new Set();

  // Grab every anchor on the page whose href contains /blog/ but whose
  // immediate slug after /blog/ is NOT a known non-article path.
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  anchors.forEach(a => {
    let href;
    try { href = new URL(a.href).href; } catch { return; }

    // Must be on uber.com
    if (!/uber\\.com/.test(href)) return;

    const pathname = new URL(href).pathname.replace(/\\/$/, '');
    const parts = pathname.split('/').filter(Boolean);

    // Pattern: …/blog/<slug>  (exactly one segment after "blog")
    const blogIdx = parts.indexOf('blog');
    if (blogIdx === -1 || parts.length !== blogIdx + 2) return;

    const slug = parts[blogIdx + 1];
    // Skip known non-article slugs and short slugs (< 10 chars)
    if (NON_ARTICLE.has(slug) || slug.length < 10) return;
    // Skip slugs that are just numbers or very short words
    if (!/[a-z].*-.*[a-z]/.test(slug)) return;

    if (seen.has(href)) return;
    seen.add(href);

    // Walk up to find the card container for this article
    let el = a;
    for (let i = 0; i < 8; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      // Stop when we find a container that holds exactly one article link
      const articleLinks = Array.from(el.querySelectorAll('a[href]'))
        .filter(x => {
          try {
            const p = new URL(x.href).pathname.replace(/\\/$/, '').split('/').filter(Boolean);
            const bi = p.indexOf('blog');
            if (bi === -1 || p.length !== bi + 2) return false;
            const s = p[bi + 1];
            return !NON_ARTICLE.has(s) && s.length >= 10 && /[a-z].*-.*[a-z]/.test(s);
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

  // Match the engineering blog hub page (any locale variant)
  matches: (url) => /uber\.com.*\/blog\/engineering\b/.test(url),

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
        publishedAt: isNaN(publishedAt) ? Date.now() : publishedAt,
        content: item.summary || '',
        summary: item.summary ? item.summary.slice(0, 500) : null,
        readTimeMin: Math.max(1, Math.ceil(wordCount / 200)),
      };
    });

    return { name: 'Uber Engineering', articles };
  },
};
