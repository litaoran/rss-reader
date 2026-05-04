import { BrowserWindow } from 'electron';

export interface ScrapedArticle {
  title: string;
  url: string;
  date?: string;
  author?: string;
  summary?: string;
}

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
