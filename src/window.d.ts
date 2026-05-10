import { Feed, Article, ArticleWithContent, FeedDiscovery, RefreshProgress } from './types';

interface RssApi {
  feeds: {
    list: () => Promise<Feed[]>;
    discover: (url: string) => Promise<FeedDiscovery>;
    add: (url: string, name: string, folder: string | null) => Promise<Feed[]>;
    remove: (id: number) => Promise<void>;
    updateFolder: (id: number, folder: string | null) => Promise<void>;
    markAllRead: (id: number) => Promise<void>;
    rename: (id: number, name: string) => Promise<void>;
    renameFolder: (oldName: string, newName: string) => Promise<void>;
    reorderFolders: (folders: string[]) => Promise<void>;
  };
  articles: {
    list: (feedId: number | null, options: {
      unreadOnly?: boolean;
      starredOnly?: boolean;
      todayOnly?: boolean;
      limit?: number;
      offset?: number;
    }) => Promise<Article[]>;
    get: (id: number) => Promise<ArticleWithContent | null>;
    fetchContent: (id: number) => Promise<string | null>;
    markRead: (id: number) => Promise<void>;
    toggleStar: (id: number) => Promise<void>;
    updateProgress: (id: number, progress: number) => Promise<void>;
    search: (query: string) => Promise<Article[]>;
  };
  refresh: {
    all: () => Promise<void>;
    feed: (id: number) => Promise<number>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    relaunch: () => Promise<void>;
    getVersion: () => Promise<string>;
  };
  on: (channel: string, fn: (...args: any[]) => void) => void;
  off: (channel: string, fn: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    rss: RssApi;
  }
}
