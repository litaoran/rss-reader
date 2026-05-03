import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import {
  initDb, listFeeds, addFeed, removeFeed, markFeedAllRead, updateFeedLastFetched,
  listArticles, getArticle, markArticleRead, toggleArticleStar,
  updateScrollProgress, searchArticles, upsertArticles,
} from './db';
import { fetchFeed, discoverFeedUrl } from './fetcher';
import { seedDefaultFeeds } from './seeds';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) app.quit();

updateElectronApp({ repo: 'litaoran/rss-reader' });

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

ipcMain.handle('feeds:discover', async (_, url: string) => {
  const feedUrl = await discoverFeedUrl(url);
  const parsed = await fetchFeed(feedUrl);
  return { feedUrl, name: parsed.name, articleCount: parsed.articles.length };
});

ipcMain.handle('feeds:add', async (_, url: string, name: string, folder: string | null) => {
  const feed = addFeed(url, name, folder);
  try {
    const parsed = await fetchFeed(url);
    upsertArticles(feed.id, parsed.articles);
    updateFeedLastFetched(feed.id);
  } catch {}
  mainWindow?.webContents.send('feeds:updated', listFeeds());
  return listFeeds();
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

app.on('ready', async () => {
  initDb();
  createWindow();
  await seedDefaultFeeds((name, done, total) => {
    mainWindow?.webContents.send('seed:progress', { name, done, total });
  });
  mainWindow?.webContents.send('feeds:updated', listFeeds());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
