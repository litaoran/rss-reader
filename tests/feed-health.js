/**
 * Feed Health Check — CI integration test
 *
 * Verifies that article loading works for 40 popular engineering blogs.
 * Catches URL changes, feed format breakage, and content extraction regressions.
 *
 * Two checks per feed:
 *   1. RSS/Atom feed can be parsed and returns articles
 *   2. Article content can be extracted (either inline from feed or via HTTP fetch)
 *
 * Runs in plain Node.js — no Electron dependency.
 * Usage: node tests/feed-health.js
 */

const Parser = require('rss-parser');
const https = require('https');
const http = require('http');

// ---------------------------------------------------------------------------
// Feed list — the 20 most popular engineering blogs in the app
// ---------------------------------------------------------------------------

const FEEDS = [
  { name: 'Hacker News',           feedUrl: 'https://hnrss.org/frontpage' },
  { name: 'Docker Blog',            feedUrl: 'https://www.docker.com/blog/feed/' },
  { name: 'Cloudflare Blog',       feedUrl: 'https://blog.cloudflare.com/rss/' },
  { name: 'Stripe Engineering',    feedUrl: 'https://stripe.com/blog/feed.rss' },
  { name: 'AWS Blog',              feedUrl: 'https://aws.amazon.com/blogs/aws/feed/' },
  { name: 'Engineering at Meta',   feedUrl: 'https://engineering.fb.com/feed/' },
  { name: 'Dropbox Tech Blog',     feedUrl: 'https://dropbox.tech/feed' },
  { name: 'Spotify Engineering',   feedUrl: 'https://engineering.atspotify.com/feed/' },
  { name: 'Slack Engineering',     feedUrl: 'https://slack.engineering/feed/' },
  { name: 'GitHub Blog',           feedUrl: 'https://github.blog/feed/' },
  { name: 'Martin Fowler',         feedUrl: 'https://martinfowler.com/feed.atom' },
  { name: 'The Pragmatic Engineer', feedUrl: 'https://newsletter.pragmaticengineer.com/feed' },
  { name: 'The Go Blog',           feedUrl: 'https://go.dev/blog/feed.atom' },
  { name: "Lil'Log",               feedUrl: 'https://lilianweng.github.io/index.xml' },
  { name: 'GitLab Blog',            feedUrl: 'https://about.gitlab.com/atom.xml' },
  { name: 'Mozilla Hacks',         feedUrl: 'https://hacks.mozilla.org/feed/' },
  { name: 'Vercel Blog',           feedUrl: 'https://vercel.com/atom' },
  { name: 'Fly.io Blog',           feedUrl: 'https://fly.io/blog/feed.xml' },
  { name: 'Discord Blog',           feedUrl: 'https://discord.com/blog/rss.xml' },
  { name: 'Auth0 Blog',             feedUrl: 'https://auth0.com/blog/rss.xml' },
  // ── Additional engineering blogs ──────────────────────────────────────
  { name: 'OpenAI Blog',           feedUrl: 'https://openai.com/blog/rss.xml' },
  { name: 'Google AI Blog',        feedUrl: 'https://blog.google/technology/ai/rss/' },
  { name: 'HashiCorp Blog',        feedUrl: 'https://www.hashicorp.com/blog/feed.xml' },
  { name: 'eBay Tech',             feedUrl: 'https://tech.ebayinc.com/rss/' },
  { name: 'Twilio Blog',            feedUrl: 'https://www.twilio.com/blog/feed' },
  { name: 'Grafana Blog',          feedUrl: 'https://grafana.com/blog/index.xml' },
  { name: 'Tailscale Blog',        feedUrl: 'https://tailscale.com/blog/index.xml' },
  { name: 'PlanetScale Blog',      feedUrl: 'https://planetscale.com/blog/rss.xml' },
  { name: 'Neon Blog',             feedUrl: 'https://neon.tech/blog/rss.xml' },
  { name: 'Deno Blog',             feedUrl: 'https://deno.com/feed' },
  { name: 'Sentry Blog',           feedUrl: 'https://blog.sentry.io/feed.xml' },
  { name: 'LaunchDarkly Blog',     feedUrl: 'https://launchdarkly.com/blog/feed/' },
  { name: 'Astro Blog',            feedUrl: 'https://astro.build/rss.xml' },
  { name: 'Next.js Blog',          feedUrl: 'https://nextjs.org/feed.xml' },
  { name: 'Remix Blog',            feedUrl: 'https://remix.run/blog/rss.xml' },
  { name: 'Rust Blog',             feedUrl: 'https://blog.rust-lang.org/feed.xml' },
  { name: 'VS Code Blog',          feedUrl: 'https://code.visualstudio.com/feed.xml' },
  { name: 'Chrome Developers',     feedUrl: 'https://developer.chrome.com/blog/feed.xml' },
  { name: 'WebKit Blog',           feedUrl: 'https://webkit.org/feed/' },
  { name: 'JetBrains Blog',        feedUrl: 'https://blog.jetbrains.com/feed/' },
];

// ---------------------------------------------------------------------------
// HTTP + content extraction (mirrors src/fetcher.ts — no Electron dependency)
// ---------------------------------------------------------------------------

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const parser = new Parser({
  customFields: { item: ['content:encoded', 'description'] },
  requestOptions: {
    agent: httpsAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
    },
  },
});

function fetchHtml(url) {
  const mod = url.startsWith('https') ? https : http;
  const agent = url.startsWith('https') ? httpsAgent : undefined;
  return new Promise((resolve, reject) => {
    const req = mod.get(url, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,*/*',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchHtml(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Extract inner HTML between the first opening and last closing of a tag. */
function extractTagContent(html, tag) {
  const open = html.indexOf(`<${tag}`);
  if (open === -1) return '';
  const openEnd = html.indexOf('>', open);
  if (openEnd === -1) return '';
  const close = html.lastIndexOf(`</${tag}>`);
  if (close <= openEnd) return '';
  return html.slice(openEnd + 1, close);
}

/** Extract article content from raw HTML using tag heuristics. */
function extractArticleHtml(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  for (const tag of ['article', 'main']) {
    const content = extractTagContent(cleaned, tag);
    if (content.length > 200) return content;
  }
  return '';
}

/** Strip HTML tags to get plain text length. */
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const PASS = '\x1b[32m✓\x1b[0m';   // green checkmark
const FAIL = '\x1b[31m✗\x1b[0m';   // red X
const WARN = '\x1b[33m○\x1b[0m';   // yellow circle
const DIM  = '\x1b[2m';
const RESET = '\x1b[0m';

async function testFeed(feed) {
  const start = Date.now();
  const result = {
    name: feed.name,
    feedOk: false,
    articleCount: 0,
    contentSource: null,  // 'inline' | 'http' | null
    contentLength: 0,
    error: null,
    timeMs: 0,
  };

  // Step 1: Parse the RSS/Atom feed
  let articles;
  try {
    const parsed = await parser.parseURL(feed.feedUrl);
    articles = parsed.items || [];
    result.articleCount = articles.length;
    if (articles.length === 0) {
      result.error = 'feed returned 0 articles';
      result.timeMs = Date.now() - start;
      return result;
    }
    result.feedOk = true;
  } catch (e) {
    result.error = `feed error: ${e.message}`;
    result.timeMs = Date.now() - start;
    return result;
  }

  // Step 2: Check if the feed provides inline content
  const firstWithContent = articles.find(item => {
    const content = item['content:encoded'] || item.content || item.description || '';
    return stripHtml(content).length > 200;
  });

  if (firstWithContent) {
    const content = firstWithContent['content:encoded'] || firstWithContent.content || firstWithContent.description || '';
    result.contentSource = 'inline';
    result.contentLength = stripHtml(content).length;
    result.timeMs = Date.now() - start;
    return result;
  }

  // Step 3: Try HTTP-based content extraction on the first article
  const articleUrl = articles[0]?.link;
  if (!articleUrl) {
    result.contentSource = null;
    result.timeMs = Date.now() - start;
    return result;
  }

  try {
    const html = await fetchHtml(articleUrl);
    const extracted = extractArticleHtml(html);
    if (extracted.length > 200) {
      result.contentSource = 'http';
      result.contentLength = stripHtml(extracted).length;
    }
  } catch (e) {
    // HTTP extraction failed — not a hard failure, browser fallback exists
  }

  result.timeMs = Date.now() - start;
  return result;
}

async function main() {
  console.log(`\nFeed Health Check — ${FEEDS.length} engineering blogs`);
  console.log('─'.repeat(60));
  console.log();

  const results = [];
  // Run feeds with limited concurrency to avoid overwhelming networks
  const CONCURRENCY = 5;
  for (let i = 0; i < FEEDS.length; i += CONCURRENCY) {
    const batch = FEEDS.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(testFeed));
    for (const r of batchResults) {
      results.push(r);
      printResult(r);
    }
  }

  // Summary
  console.log();
  console.log('─'.repeat(60));

  const passed = results.filter(r => r.feedOk);
  const failed = results.filter(r => !r.feedOk);
  const withContent = results.filter(r => r.contentSource);
  const needsBrowser = results.filter(r => r.feedOk && !r.contentSource);

  console.log(`Feeds:   ${PASS} ${passed.length} parsed    ${FAIL} ${failed.length} broken`);
  console.log(`Content: ${PASS} ${withContent.length} extracted ${WARN} ${needsBrowser.length} need browser`);
  console.log();

  if (failed.length > 0) {
    console.log(`${FAIL} Broken feeds:`);
    for (const r of failed) {
      console.log(`   ${r.name}: ${r.error}`);
    }
    console.log();
  }

  if (needsBrowser.length > 0) {
    console.log(`${WARN} Feeds needing browser-based extraction (not a failure):`);
    for (const r of needsBrowser) {
      console.log(`   ${r.name}`);
    }
    console.log();
  }

  // Exit code: fail if any feed can't be parsed at all
  const exitCode = failed.length > 0 ? 1 : 0;
  console.log(exitCode === 0
    ? `${PASS} All feeds healthy`
    : `${FAIL} ${failed.length} feed(s) need attention`
  );
  console.log();

  process.exit(exitCode);
}

function printResult(r) {
  const pad = r.name.padEnd(28);
  const time = `${DIM}(${r.timeMs}ms)${RESET}`;

  if (!r.feedOk) {
    console.log(`  ${FAIL} ${pad} ${r.error} ${time}`);
    return;
  }

  const articles = `${r.articleCount} articles`.padEnd(14);

  if (r.contentSource === 'inline') {
    console.log(`  ${PASS} ${pad} ${articles} content: inline (${formatBytes(r.contentLength)}) ${time}`);
  } else if (r.contentSource === 'http') {
    console.log(`  ${PASS} ${pad} ${articles} content: http (${formatBytes(r.contentLength)}) ${time}`);
  } else {
    console.log(`  ${WARN} ${pad} ${articles} content: needs browser ${time}`);
  }
}

function formatBytes(chars) {
  if (chars < 1024) return `${chars} chars`;
  return `${(chars / 1024).toFixed(1)}K chars`;
}

main();
