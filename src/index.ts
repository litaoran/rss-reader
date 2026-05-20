import { app, autoUpdater, BrowserWindow, ipcMain, shell } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import {
  initDb, listFeeds, addFeed, removeFeed, markFeedAllRead, updateFeedLastFetched,
  listArticles, getArticle, markArticleRead, toggleArticleStar,
  updateScrollProgress, updateArticleContent, updateArticlePublishedAt,
  searchArticles, upsertArticles, renameFeed, renameFeedFolder, updateFeedFolder, cleanupBadArticles,
  updateFeedFavicon, reorderFolders, markFeedAsScraped, getScrapedFeedUrls,
} from './db';
import { fetchFeed, discoverFeedUrl, fetchFaviconUrl } from './fetcher';
import { scrapeWithBrowser } from './scrapers/browser';
import { EXTRACT_ARTICLE_CONTENT_JS, EXTRACT_DATE_JS } from './scrapers/uber';
import { registerGenericUrl } from './scrapers/index';
import { isGenericUrl } from './scrapers/generic';
import { seedDefaultFeeds } from './seeds';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) app.quit();

// Prevent Chromium from accessing the macOS keychain for its password/cookie
// store. Antenna stores no credentials, so the plain store is sufficient and
// avoids the "Antenna Safe Storage" Keychain prompt on every launch.
app.commandLine.appendSwitch('password-store', 'basic');

updateElectronApp({ repo: 'litaoran/rss-reader', notifyUser: false });

// Notify renderer when an update has been downloaded and is ready to install
autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update:ready');
});

let mainWindow: BrowserWindow | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  startAutoRefresh();
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshAllFeeds, REFRESH_INTERVAL_MS);
}

async function refreshAllFeeds() {
  const feeds = listFeeds();
  mainWindow?.webContents.send('refresh:progress', { isRefreshing: true });

  for (const feed of feeds) {
    try {
      mainWindow?.webContents.send('refresh:progress', { isRefreshing: true, feedId: feed.id });
      const parsed = await fetchFeed(feed.url);
      const newCount = upsertArticles(feed.id, parsed.articles);
      updateFeedLastFetched(feed.id);
      if (newCount > 0) {
        mainWindow?.webContents.send('articles:new', { feedId: feed.id, count: newCount });
      }
    } catch (e) {
      console.error(`Failed to refresh feed ${feed.url}:`, e);
    }
  }

  mainWindow?.webContents.send('refresh:progress', { isRefreshing: false });
  mainWindow?.webContents.send('feeds:updated', listFeeds());
}

ipcMain.handle('feeds:list', () => listFeeds());

// Cache discovery results for 10 min so feeds:add doesn't re-scrape
const discoveryCache = new Map<string, { parsed: any; expiresAt: number }>();

ipcMain.handle('feeds:discover', async (_, url: string) => {
  const feedUrl = await discoverFeedUrl(url);
  const parsed = await fetchFeed(feedUrl);
  discoveryCache.set(feedUrl, { parsed, expiresAt: Date.now() + 10 * 60 * 1000 });
  return { feedUrl, name: parsed.name, articleCount: parsed.articles.length };
});

ipcMain.handle('feeds:add', async (_, url: string, name: string, folder: string | null) => {
  const feed = addFeed(url, name, folder);
  // Mark scraped feeds so the generic adapter is used on future refreshes
  if (isGenericUrl(url)) markFeedAsScraped(feed.id);
  try {
    const cached = discoveryCache.get(url);
    const parsed = (cached && cached.expiresAt > Date.now())
      ? cached.parsed
      : await fetchFeed(url);
    discoveryCache.delete(url);
    upsertArticles(feed.id, parsed.articles);
    updateFeedLastFetched(feed.id);
  } catch {}
  // Fetch favicon in background
  fetchFaviconUrl(url).then(iconUrl => {
    if (iconUrl) {
      updateFeedFavicon(feed.id, iconUrl);
      mainWindow?.webContents.send('feeds:updated', listFeeds());
    }
  }).catch(() => {});
  mainWindow?.webContents.send('feeds:updated', listFeeds());
  return listFeeds();
});

ipcMain.handle('feeds:updateFolder', (_, id: number, folder: string | null) => {
  updateFeedFolder(id, folder);
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

ipcMain.handle('feeds:reorderFolders', (_, folders: string[]) => {
  reorderFolders(folders);
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

ipcMain.handle('feeds:rename', (_, id: number, name: string) => {
  renameFeed(id, name);
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

ipcMain.handle('feeds:renameFolder', (_, oldName: string, newName: string) => {
  renameFeedFolder(oldName, newName);
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

ipcMain.handle('feeds:remove', (_, id: number) => {
  removeFeed(id);
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

ipcMain.handle('feeds:markAllRead', (_, id: number) => {
  markFeedAllRead(id);
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

ipcMain.handle('articles:list', (_, feedId: number | null, options: any) =>
  listArticles({ feedId, limit: 100, offset: 0, ...options })
);

ipcMain.handle('articles:get', (_, id: number) => getArticle(id));

ipcMain.handle('articles:fetchContent', async (_, id: number) => {
  const article = getArticle(id);
  if (!article) return null;
  // Treat very short content (< 200 chars) as a stub/summary — re-fetch the
  // full article.  The generic scraper sometimes stores category labels or
  // excerpts as "content" which aren't the real article body.
  if (article.content && article.content.length > 200) {
    // Content already stored — still try to backfill date if missing
    if (!article.publishedAt) {
      try {
        const ts = await scrapeWithBrowser<number | null>(article.url, EXTRACT_DATE_JS, { waitMs: 2500 });
        if (ts && !isNaN(ts)) updateArticlePublishedAt(id, ts);
      } catch {}
    }
    return article.content;
  }

  try {
    // Fetch content and date in parallel using the same page load
    const [html, ts] = await Promise.all([
      scrapeWithBrowser<string>(article.url, EXTRACT_ARTICLE_CONTENT_JS, { waitMs: 2500 }),
      scrapeWithBrowser<number | null>(article.url, EXTRACT_DATE_JS, { waitMs: 2500 }),
    ]);
    if (html) updateArticleContent(id, html);
    if (ts && !isNaN(ts)) updateArticlePublishedAt(id, ts);
    return html;
  } catch (e) {
    console.error(`Failed to fetch content for article ${id}:`, e);
    return null;
  }
});

ipcMain.handle('articles:markRead', (_, id: number) => markArticleRead(id));

ipcMain.handle('articles:toggleStar', (_, id: number) => toggleArticleStar(id));

ipcMain.handle('articles:updateProgress', (_, id: number, progress: number) =>
  updateScrollProgress(id, progress)
);

ipcMain.handle('articles:search', (_, query: string) => searchArticles(query));

ipcMain.handle('refresh:all', async () => refreshAllFeeds());

ipcMain.handle('refresh:feed', async (_, id: number) => {
  const feeds = listFeeds();
  const feed = feeds.find(f => f.id === id);
  if (!feed) return 0;
  mainWindow?.webContents.send('refresh:progress', { isRefreshing: true, feedId: id });
  try {
    const parsed = await fetchFeed(feed.url);
    const newCount = upsertArticles(id, parsed.articles);
    updateFeedLastFetched(id);
    mainWindow?.webContents.send('feeds:updated', listFeeds());
    return newCount;
  } finally {
    mainWindow?.webContents.send('refresh:progress', { isRefreshing: false });
  }
});

ipcMain.handle('shell:openExternal', (_, url: string) => shell.openExternal(url));

ipcMain.handle('app:relaunch', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('app:version', () => app.getVersion());

app.on('ready', async () => {
  // Strip Referer from outgoing image requests so hotlink protection doesn't block them
  const { session } = await import('electron');
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*/*', 'http://*/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      if (details.resourceType === 'image') {
        delete headers['Referer'];
        delete headers['Origin'];
      }
      callback({ requestHeaders: headers });
    }
  );
  initDb();
  // Migrate existing folder names for users upgrading from older versions
  renameFeedFolder('Aggregators', 'News');
  renameFeedFolder('Individual Engineers', 'Writers');
  // Remove articles inserted by earlier buggy scrapers
  cleanupBadArticles();
  // Re-register scraped feed URLs so the generic adapter recognises them
  for (const url of getScrapedFeedUrls()) registerGenericUrl(url);
  createWindow();
  await seedDefaultFeeds((name, done, total) => {
    mainWindow?.webContents.send('seed:progress', { name, done, total });
  });
  mainWindow?.webContents.send('feeds:updated', listFeeds());

  // Backfill favicons for feeds that don't have one yet
  const feedsNeedingFavicons = listFeeds().filter(f => !f.faviconUrl);
  (async () => {
    for (const feed of feedsNeedingFavicons) {
      try {
        const iconUrl = await fetchFaviconUrl(feed.url);
        if (iconUrl) {
          updateFeedFavicon(feed.id, iconUrl);
        }
      } catch {}
    }
    if (feedsNeedingFavicons.length > 0) {
      mainWindow?.webContents.send('feeds:updated', listFeeds());
    }
  })();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
