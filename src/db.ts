import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { Feed, Article, ArticleWithContent } from './types';

const DB_PATH = path.join(app.getPath('userData'), 'rss-reader.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

// Called from index.ts on app ready — synchronous, no await needed
export function initDb(): void {
  getDb();
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      folder TEXT,
      lastFetched INTEGER,
      isActive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedId INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      author TEXT,
      publishedAt INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      summary TEXT,
      isRead INTEGER NOT NULL DEFAULT 0,
      isStarred INTEGER NOT NULL DEFAULT 0,
      scrollProgress REAL NOT NULL DEFAULT 0,
      readTimeMin INTEGER NOT NULL DEFAULT 1,
      fetchedAt INTEGER NOT NULL,
      UNIQUE(feedId, guid)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title, summary, content,
      content=articles,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, summary, content)
        VALUES (new.id, new.title, new.summary, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, summary, content)
        VALUES('delete', old.id, old.title, old.summary, old.content);
    END;
  `);
}

export function listFeeds(): Feed[] {
  const rows = getDb().prepare(`
    SELECT f.*,
      COUNT(CASE WHEN a.isRead = 0 THEN 1 END) as unreadCount,
      (f.lastFetched IS NULL OR f.lastFetched < ? ) as isStale
    FROM feeds f
    LEFT JOIN articles a ON a.feedId = f.id
    WHERE f.isActive = 1
    GROUP BY f.id
    ORDER BY f.folder NULLS LAST, f.name
  `).all(Date.now() - 7 * 24 * 60 * 60 * 1000) as any[];

  return rows.map(r => ({
    id: r.id,
    url: r.url,
    name: r.name,
    folder: r.folder || null,
    lastFetched: r.lastFetched || null,
    unreadCount: r.unreadCount,
    isStale: Boolean(r.isStale),
  }));
}

export function addFeed(url: string, name: string, folder: string | null): Feed {
  const db = getDb();
  // If the URL already exists (e.g. was previously removed), reactivate it
  const existing = db.prepare('SELECT id FROM feeds WHERE url = ?').get(url) as { id: number } | undefined;
  if (existing) {
    db.prepare('UPDATE feeds SET name = ?, folder = ?, isActive = 1 WHERE id = ?')
      .run(name, folder, existing.id);
    return { id: existing.id, url, name, folder, lastFetched: null, unreadCount: 0, isStale: false };
  }
  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO feeds (url, name, folder) VALUES (?, ?, ?)'
  ).run(url, name, folder);
  return { id: id as number, url, name, folder, lastFetched: null, unreadCount: 0, isStale: false };
}

export function removeFeed(id: number) {
  getDb().prepare('UPDATE feeds SET isActive = 0 WHERE id = ?').run(id);
}

export function updateFeedFolder(id: number, folder: string | null) {
  getDb().prepare('UPDATE feeds SET folder = ? WHERE id = ?').run(folder, id);
}

export function markFeedAllRead(feedId: number) {
  getDb().prepare('UPDATE articles SET isRead = 1 WHERE feedId = ?').run(feedId);
}

export function updateFeedLastFetched(feedId: number) {
  getDb().prepare('UPDATE feeds SET lastFetched = ? WHERE id = ?').run(Date.now(), feedId);
}

export interface ArticleListOptions {
  feedId: number | null;
  unreadOnly: boolean;
  starredOnly?: boolean;
  todayOnly?: boolean;
  limit: number;
  offset: number;
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

  return (getDb().prepare(`
    SELECT a.*, f.name as feedName
    FROM articles a JOIN feeds f ON f.id = a.feedId
    ${where}
    ORDER BY a.publishedAt DESC
    LIMIT ? OFFSET ?
  `).all(...params, opts.limit, opts.offset) as any[]).map(rowToArticle);
}

export function getArticle(id: number): ArticleWithContent | null {
  const r = getDb().prepare(`
    SELECT a.*, f.name as feedName
    FROM articles a JOIN feeds f ON f.id = a.feedId
    WHERE a.id = ?
  `).get(id) as any;
  return r ? { ...rowToArticle(r), content: r.content } : null;
}

export function markArticleRead(id: number) {
  getDb().prepare('UPDATE articles SET isRead = 1 WHERE id = ?').run(id);
}

export function toggleArticleStar(id: number) {
  getDb().prepare('UPDATE articles SET isStarred = NOT isStarred WHERE id = ?').run(id);
}

export function updateScrollProgress(id: number, progress: number) {
  getDb().prepare('UPDATE articles SET scrollProgress = ? WHERE id = ?').run(progress, id);
}

export function updateArticleContent(id: number, content: string) {
  getDb().prepare('UPDATE articles SET content = ? WHERE id = ?').run(content, id);
}

export function searchArticles(query: string): Article[] {
  return (getDb().prepare(`
    SELECT a.*, f.name as feedName
    FROM articles_fts fts
    JOIN articles a ON a.id = fts.rowid
    JOIN feeds f ON f.id = a.feedId
    WHERE articles_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `).all(query + '*') as any[]).map(rowToArticle);
}

export function upsertArticles(
  feedId: number,
  articles: Omit<ArticleWithContent, 'id' | 'feedId' | 'feedName' | 'isRead' | 'isStarred' | 'scrollProgress'>[]
): number {
  const insert = getDb().prepare(`
    INSERT OR IGNORE INTO articles
      (feedId, guid, title, url, author, publishedAt, content, summary, readTimeMin, fetchedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  let inserted = 0;
  const insertMany = getDb().transaction((items: typeof articles) => {
    for (const a of items) {
      const info = insert.run(
        feedId, a.guid, a.title, a.url, a.author,
        a.publishedAt, a.content, a.summary, a.readTimeMin, now
      );
      if (info.changes > 0) inserted++;
    }
  });
  insertMany(articles);
  return inserted;
}

export function renameFeedFolder(oldFolder: string, newFolder: string): void {
  getDb().prepare('UPDATE feeds SET folder = ? WHERE folder = ?').run(newFolder, oldFolder);
}
