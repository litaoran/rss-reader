export interface Feed {
  id: number;
  url: string;
  name: string;
  folder: string | null;
  lastFetched: number | null;
  unreadCount: number;
  isStale: boolean;
}

export interface Article {
  id: number;
  feedId: number;
  feedName: string;
  guid: string;
  title: string;
  url: string;
  author: string | null;
  publishedAt: number;
  summary: string | null;
  isRead: boolean;
  isStarred: boolean;
  scrollProgress: number;
  readTimeMin: number;
}

export interface ArticleWithContent extends Article {
  content: string;
}

export interface FeedDiscovery {
  feedUrl: string;
  name: string;
  articleCount: number;
}

export interface RefreshProgress {
  isRefreshing: boolean;
  feedId?: number;
}

export type SmartFeedId = 'all' | 'starred' | 'today';
export type SelectedFeed = SmartFeedId | number;
