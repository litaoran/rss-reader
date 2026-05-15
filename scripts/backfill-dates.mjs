/**
 * One-off script: fetch published dates from article pages and write them to the DB.
 * Run with: node scripts/backfill-dates.mjs
 */
import https from 'https';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

const DB = path.join(os.homedir(), 'Library/Application Support/Antenna/rss-reader.db');
const agent = new https.Agent({ rejectUnauthorized: false });

function sql(query) {
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(query)}`).toString().trim();
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const options = {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,*/*',
      },
    };
    const req = https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchHtml(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractDate(html) {
  // 1. JSON-LD datePublished
  const ldMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  if (ldMatch) return new Date(ldMatch[1]).getTime();

  // 2. <meta property="article:published_time">
  const metaMatch = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i);
  if (metaMatch) return new Date(metaMatch[1]).getTime();

  // 3. <meta name="date"> or <meta name="publish-date">
  const metaName = html.match(/<meta[^>]+name=["'](?:date|publish[-_]?date|pubdate)["'][^>]+content=["']([^"']+)["']/i);
  if (metaName) return new Date(metaName[1]).getTime();

  // 4. <time datetime="...">
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (timeMatch) return new Date(timeMatch[1]).getTime();

  return null;
}

// Get all scraped articles with publishedAt = 0
const rows = sql(`SELECT id, url FROM articles WHERE publishedAt = 0 AND (url LIKE '%uber.com%' OR url LIKE '%careersatdoordash.com%')`)
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [id, ...rest] = line.split('|');
    return { id, url: rest.join('|') };
  });

console.log(`Found ${rows.length} articles to backfill.\n`);

let updated = 0;
let failed = 0;

for (const { id, url } of rows) {
  process.stdout.write(`  [${id}] ${url.slice(0, 70)}… `);
  try {
    const html = await fetchHtml(url);
    const ts = extractDate(html);
    if (ts && !isNaN(ts) && ts > 0) {
      sql(`UPDATE articles SET publishedAt = ${ts} WHERE id = ${id}`);
      console.log(`→ ${new Date(ts).toLocaleDateString()}`);
      updated++;
    } else {
      console.log('→ no date found');
      failed++;
    }
  } catch (e) {
    console.log(`→ error: ${e.message}`);
    failed++;
  }
  // Small delay to avoid hammering the servers
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nDone. Updated: ${updated}, no date found: ${failed}`);
