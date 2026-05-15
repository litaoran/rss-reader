import { open } from '@op-engineering/op-sqlite';
import {
  SCHEMA_SQL,
  STALE_THRESHOLD_MS,
  type Feed,
  type Article,
  type ArticleWithContent,
  type ArticleListOptions,
} from '@antenna/shared';

let db: ReturnType<typeof open>;

export function initDb(): void {
  db = open({ name: 'antenna.db' });
  db.executeSync('PRAGMA journal_mode = WAL');
  db.executeSync('PRAGMA foreign_keys = ON');
  migrate();
}

function migrate(): void {
  // Split SCHEMA_SQL into individual statements (op-sqlite doesn't support multi-statement exec)
  const statements = SCHEMA_SQL.split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  for (const stmt of statements) {
    db.executeSync(stmt + ';');
  }
}

export function listFeeds(): Feed[] {
  const result = db.executeSync(
    `SELECT f.*,
      COUNT(CASE WHEN a.isRead = 0 THEN 1 END) as unreadCount,
      (f.lastFetched IS NULL OR f.lastFetched < ?) as isStale
    FROM feeds f
    LEFT JOIN articles a ON a.feedId = f.id
    WHERE f.isActive = 1
    GROUP BY f.id
    ORDER BY CASE WHEN f.folder IS NULL THEN 1 ELSE 0 END, f.folderOrder, f.folder, f.name`,
    [Date.now() - STALE_THRESHOLD_MS],
  );

  const rows = result.rows ?? [];
  return rows.map((r: any) => ({
    id: r.id,
    url: r.url,
    name: r.name,
    folder: r.folder || null,
    lastFetched: r.lastFetched || null,
    unreadCount: r.unreadCount,
    isStale: Boolean(r.isStale),
    faviconUrl: r.faviconUrl || null,
  }));
}

export function addFeed(url: string, name: string, folder: string | null): Feed {
  const existing = db.executeSync('SELECT id FROM feeds WHERE url = ?', [url]);
  if (existing.rows && existing.rows.length > 0) {
    const id = (existing.rows[0] as any).id;
    db.executeSync('UPDATE feeds SET name = ?, folder = ?, isActive = 1 WHERE id = ?', [name, folder, id]);
    return { id, url, name, folder, lastFetched: null, unreadCount: 0, isStale: false, faviconUrl: null };
  }
  const result = db.executeSync(
    'INSERT OR IGNORE INTO feeds (url, name, folder) VALUES (?, ?, ?)',
    [url, name, folder],
  );
  return {
    id: result.insertId!,
    url,
    name,
    folder,
    lastFetched: null,
    unreadCount: 0,
    isStale: false,
    faviconUrl: null,
  };
}

export function removeFeed(id: number): void {
  db.executeSync('UPDATE feeds SET isActive = 0 WHERE id = ?', [id]);
}

export function markFeedAllRead(feedId: number): void {
  db.executeSync('UPDATE articles SET isRead = 1 WHERE feedId = ?', [feedId]);
}

export function updateFeedLastFetched(feedId: number): void {
  db.executeSync('UPDATE feeds SET lastFetched = ? WHERE id = ?', [Date.now(), feedId]);
}

export function updateFeedFavicon(id: number, faviconUrl: string): void {
  db.executeSync('UPDATE feeds SET faviconUrl = ? WHERE id = ?', [faviconUrl, id]);
}

function rowToArticle(r: any): Article {
  return {
    id: r.id,
    feedId: r.feedId,
    feedName: r.feedName,
    guid: r.guid,
    title: r.title,
    url: r.url,
    author: r.author || null,
    publishedAt: r.publishedAt,
    summary: r.summary || null,
    isRead: Boolean(r.isRead),
    isStarred: Boolean(r.isStarred),
    scrollProgress: r.scrollProgress || 0,
    readTimeMin: r.readTimeMin || 1,
  };
}

export function listArticles(opts: ArticleListOptions): Article[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts.feedId !== null) { conditions.push('a.feedId = ?'); params.push(opts.feedId); }
  if (opts.unreadOnly) conditions.push('a.isRead = 0');
  if (opts.starredOnly) conditions.push('a.isStarred = 1');
  if (opts.todayOnly) {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    conditions.push('a.publishedAt >= ?'); params.push(midnight.getTime());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(opts.limit, opts.offset);

  const result = db.executeSync(
    `SELECT a.*, f.name as feedName
    FROM articles a JOIN feeds f ON f.id = a.feedId
    ${where}
    ORDER BY CASE WHEN a.publishedAt = 0 THEN a.fetchedAt ELSE a.publishedAt END DESC
    LIMIT ? OFFSET ?`,
    params,
  );

  return (result.rows ?? []).map(rowToArticle);
}

export function getArticle(id: number): ArticleWithContent | null {
  const result = db.executeSync(
    `SELECT a.*, f.name as feedName
    FROM articles a JOIN feeds f ON f.id = a.feedId
    WHERE a.id = ?`,
    [id],
  );
  const r = result.rows?.[0] as any;
  return r ? { ...rowToArticle(r), content: r.content } : null;
}

export function markArticleRead(id: number): void {
  db.executeSync('UPDATE articles SET isRead = 1 WHERE id = ?', [id]);
}

export function toggleArticleStar(id: number): void {
  db.executeSync('UPDATE articles SET isStarred = NOT isStarred WHERE id = ?', [id]);
}

export function upsertArticles(
  feedId: number,
  articles: { guid: string; title: string; url: string; author: string | null; publishedAt: number; content: string; summary: string | null; readTimeMin: number }[],
): number {
  const now = Date.now();
  let inserted = 0;
  for (const a of articles) {
    const result = db.executeSync(
      `INSERT OR IGNORE INTO articles
        (feedId, guid, title, url, author, publishedAt, content, summary, readTimeMin, fetchedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [feedId, a.guid, a.title, a.url, a.author, a.publishedAt, a.content, a.summary, a.readTimeMin, now],
    );
    if (result.rowsAffected > 0) inserted++;
  }
  return inserted;
}

export function renameFeed(id: number, name: string): void {
  db.executeSync('UPDATE feeds SET name = ? WHERE id = ?', [name, id]);
}

export function renameFeedFolder(oldFolder: string, newFolder: string): void {
  db.executeSync('UPDATE feeds SET folder = ? WHERE folder = ?', [newFolder, oldFolder]);
}
