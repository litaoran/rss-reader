import { BrowserWindow, session } from 'electron';

export interface ScrapedArticle {
  title: string;
  url: string;
  date?: string;
  author?: string;
  summary?: string;
}

/**
 * Persistent partition used by all scraper BrowserWindows.
 * Cookies and login state survive across scrapes and app restarts.
 * Users can sign in via a visible window (scraper:signIn IPC) and
 * future hidden scrapes will reuse those cookies.
 */
export const SCRAPER_PARTITION = 'persist:scraper';

/**
 * Load a URL in a hidden BrowserWindow, wait for it to fully render
 * (including JS-driven content), then run extractJs in the page context
 * and return whatever it returns.
 *
 * extractJs must be a self-invoking JS expression that returns a value
 * serialisable to JSON, e.g.:
 *   "(() => { return document.title; })()"
 */
export async function scrapeWithBrowser<T>(
  url: string,
  extractJs: string,
  { waitMs = 2500 }: { waitMs?: number } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true,
        partition: SCRAPER_PARTITION,
      },
    });

    const timeout = setTimeout(() => {
      win.destroy();
      reject(new Error(`Scrape timed out for ${url}`));
    }, 30_000);

    win.webContents.once('did-finish-load', () => {
      // Give JS-rendered content time to populate after initial load
      setTimeout(async () => {
        try {
          const result = await win.webContents.executeJavaScript(extractJs);
          resolve(result as T);
        } catch (e) {
          reject(e);
        } finally {
          clearTimeout(timeout);
          win.destroy();
        }
      }, waitMs);
    });

    win.webContents.once('did-fail-load', (_, code, desc) => {
      clearTimeout(timeout);
      win.destroy();
      reject(new Error(`Failed to load ${url}: ${desc} (${code})`));
    });

    win.loadURL(url, {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
  });
}

/**
 * Load a URL once in a single hidden BrowserWindow and run multiple JS
 * extraction scripts sequentially on the same page. Returns results as
 * a tuple — avoids spawning separate windows for each script.
 */
export async function scrapeWithBrowserMulti<T extends any[]>(
  url: string,
  scripts: string[],
  { waitMs = 800 }: { waitMs?: number } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true,
        partition: SCRAPER_PARTITION,
      },
    });

    const timeout = setTimeout(() => {
      win.destroy();
      reject(new Error(`Scrape timed out for ${url}`));
    }, 30_000);

    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const results = [];
          for (const script of scripts) {
            results.push(await win.webContents.executeJavaScript(script));
          }
          resolve(results as T);
        } catch (e) {
          reject(e);
        } finally {
          clearTimeout(timeout);
          win.destroy();
        }
      }, waitMs);
    });

    win.webContents.once('did-fail-load', (_, code, desc) => {
      clearTimeout(timeout);
      win.destroy();
      reject(new Error(`Failed to load ${url}: ${desc} (${code})`));
    });

    win.loadURL(url, {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
  });
}
