import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Feed, Article, ArticleWithContent, SelectedFeed, RefreshProgress } from './types';
import { TopBar } from './components/TopBar';
import { FeedSidebar } from './components/FeedSidebar';
import { ArticleList } from './components/ArticleList';
import { ReadingPane } from './components/ReadingPane';
import { AddFeedSheet } from './components/AddFeedSheet';
import { SearchOverlay } from './components/SearchOverlay';

function useResizeHandle(initialWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(max, Math.max(min, startWidth.current + ev.clientX - startX.current));
      setWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, min, max]);

  return { width, onMouseDown };
}

export function App() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<SelectedFeed>('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithContent | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unreadPrefs = useRef<Record<string, boolean>>({});
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress>({ isRefreshing: false });
  const [newArticleNotice, setNewArticleNotice] = useState<{ count: number } | null>(null);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [seedProgress, setSeedProgress] = useState<{ name: string; done: number; total: number } | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const noticeTimer = useRef<NodeJS.Timeout | null>(null);
  const sidebar = useResizeHandle(220, 160, 360);
  const articleList = useResizeHandle(300, 200, 560);

  useEffect(() => {
    window.rss.feeds.list().then(setFeeds);
    loadArticles('all', true);
  }, []);

  // IPC push listeners
  useEffect(() => {
    const onFeedsUpdated = (updated: Feed[]) => setFeeds(updated);
    const onRefreshProgress = (p: RefreshProgress) => setRefreshProgress(p);
    const onArticlesNew = ({ count }: { feedId: number; count: number }) => {
      setNewArticleNotice({ count });
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNewArticleNotice(null), 8000);
    };

    const onSeedProgress = (p: { name: string; done: number; total: number }) => {
      setSeedProgress(p);
      if (p.done + 1 >= p.total) setTimeout(() => setSeedProgress(null), 1000);
    };
    const onFeedsUpdatedAfterSeed = (updated: Feed[]) => {
      setFeeds(updated);
      loadArticles('all', true);
    };

    const onUpdateReady = () => setUpdateReady(true);

    window.rss.on('feeds:updated', onFeedsUpdated);
    window.rss.on('feeds:updated', onFeedsUpdatedAfterSeed);
    window.rss.on('refresh:progress', onRefreshProgress);
    window.rss.on('articles:new', onArticlesNew);
    window.rss.on('seed:progress', onSeedProgress);
    window.rss.on('update:ready', onUpdateReady);
    return () => {
      window.rss.off('feeds:updated', onFeedsUpdated);
      window.rss.off('feeds:updated', onFeedsUpdatedAfterSeed);
      window.rss.off('refresh:progress', onRefreshProgress);
      window.rss.off('articles:new', onArticlesNew);
      window.rss.off('seed:progress', onSeedProgress);
      window.rss.off('update:ready', onUpdateReady);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') { e.preventDefault(); setShowSearch(true); }
      if (e.metaKey && e.key === 'n') { e.preventDefault(); setShowAddFeed(true); }
      if (e.metaKey && e.shiftKey && e.key === 'R') { e.preventDefault(); handleRefreshAll(); }
      if (e.metaKey && e.key === 'r') { e.preventDefault(); handleRefreshCurrent(); }
      if (e.key === 'Escape') { setShowSearch(false); setShowAddFeed(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFeed]);

  async function loadArticles(feed: SelectedFeed, unreadOnlyOverride?: boolean) {
    const uo = unreadOnlyOverride ?? unreadOnly;
    const opts: any = { unreadOnly: uo, limit: 100, offset: 0 };
    let feedId: number | null = null;

    if (feed === 'starred') { opts.starredOnly = true; opts.unreadOnly = false; }
    else if (feed === 'today') { opts.todayOnly = true; }
    else if (typeof feed === 'number') { feedId = feed; }

    const items = await window.rss.articles.list(feedId, opts);
    setArticles(items);
    setSelectedArticle(null);
  }

  const handleSelectFeed = useCallback((feed: SelectedFeed) => {
    // Save current feed's unread pref before switching
    unreadPrefs.current[String(selectedFeed)] = unreadOnly;
    // Restore the target feed's pref (default: show all)
    const restored = unreadPrefs.current[String(feed)] ?? false;
    setUnreadOnly(restored);
    setSelectedFeed(feed);
    loadArticles(feed, restored);
  }, [unreadOnly, selectedFeed]);

  const handleSelectArticle = useCallback(async (article: Article) => {
    const full = await window.rss.articles.get(article.id);
    setSelectedArticle(full);
    if (!article.isRead) {
      await window.rss.articles.markRead(article.id);
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, isRead: true } : a));
      setFeeds(prev => prev.map(f =>
        f.id === article.feedId ? { ...f, unreadCount: Math.max(0, f.unreadCount - 1) } : f
      ));
    }
  }, []);

  const handleToggleStar = useCallback(async (id: number) => {
    await window.rss.articles.toggleStar(id);
    setArticles(prev => prev.map(a => a.id === id ? { ...a, isStarred: !a.isStarred } : a));
    if (selectedArticle?.id === id) {
      setSelectedArticle(prev => prev ? { ...prev, isStarred: !prev.isStarred } : prev);
    }
  }, [selectedArticle]);

  const handleRefreshAll = async () => {
    await window.rss.refresh.all();
    loadArticles(selectedFeed);
  };

  const handleRefreshCurrent = async () => {
    if (typeof selectedFeed === 'number') {
      await window.rss.refresh.feed(selectedFeed);
    } else {
      await window.rss.refresh.all();
    }
    loadArticles(selectedFeed);
  };

  const handleToggleUnreadOnly = useCallback(() => {
    const next = !unreadOnly;
    setUnreadOnly(next);
    unreadPrefs.current[String(selectedFeed)] = next;
    loadArticles(selectedFeed, next);
  }, [unreadOnly, selectedFeed]);

  const handleMarkAllRead = useCallback(async (feedId: number) => {
    await window.rss.feeds.markAllRead(feedId);
    setArticles(prev => prev.map(a => a.feedId === feedId ? { ...a, isRead: true } : a));
    setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, unreadCount: 0 } : f));
  }, []);

  const handleFeedAdded = useCallback((updatedFeeds: Feed[]) => {
    setFeeds(updatedFeeds);
    setShowAddFeed(false);
    loadArticles(selectedFeed);
  }, [selectedFeed]);

  const handleRemoveFeed = useCallback(async (id: number) => {
    await window.rss.feeds.remove(id);
    if (selectedFeed === id) {
      setSelectedFeed('all');
      loadArticles('all');
    }
  }, [selectedFeed]);

  const handleMoveToFolder = useCallback(async (feedId: number, folder: string | null) => {
    await window.rss.feeds.updateFolder(feedId, folder);
  }, []);

  const handleReorderFolders = useCallback(async (folders: string[]) => {
    await window.rss.feeds.reorderFolders(folders);
  }, []);

  return (
    <div style={styles.app}>
      <TopBar
        refreshProgress={refreshProgress}
        onSearch={() => setShowSearch(true)}
      />
      <div style={styles.body}>
        <FeedSidebar
          feeds={feeds}
          selectedFeed={selectedFeed}
          onSelectFeed={handleSelectFeed}
          onMarkAllRead={handleMarkAllRead}
          onRemoveFeed={handleRemoveFeed}
          onAddFeed={() => setShowAddFeed(true)}
          onRefreshAll={handleRefreshAll}
          isRefreshing={refreshProgress.isRefreshing}
          onMoveToFolder={handleMoveToFolder}
          onReorderFolders={handleReorderFolders}
          width={sidebar.width}
          updateReady={updateReady}
          onRelaunch={() => window.rss.app.relaunch()}
        />
        <div style={styles.resizeHandle} onMouseDown={sidebar.onMouseDown} />
        <ArticleList
          articles={articles}
          selectedArticle={selectedArticle}
          unreadOnly={unreadOnly}
          newArticleNotice={newArticleNotice}
          onSelectArticle={handleSelectArticle}
          onToggleStar={handleToggleStar}
          onToggleUnreadOnly={handleToggleUnreadOnly}
          onDismissNotice={() => setNewArticleNotice(null)}
          onScrollToTop={() => loadArticles(selectedFeed)}
          width={articleList.width}
        />
        <div style={styles.resizeHandle} onMouseDown={articleList.onMouseDown} />
        <ReadingPane
          article={selectedArticle}
          onToggleStar={handleToggleStar}
          onOpenExternal={(url) => window.rss.shell.openExternal(url)}
          onProgress={(id, p) => window.rss.articles.updateProgress(id, p)}
        />
      </div>
      {showAddFeed && (
        <AddFeedSheet
          onClose={() => setShowAddFeed(false)}
          onAdded={handleFeedAdded}
          existingFolders={[...new Set(feeds.map(f => f.folder).filter(Boolean) as string[])]}
        />
      )}
      {showSearch && (
        <SearchOverlay
          onClose={() => setShowSearch(false)}
          onSelectArticle={(a) => { setShowSearch(false); handleSelectArticle(a); }}
        />
      )}
      {seedProgress && (
        <div style={styles.seedBanner}>
          <div style={styles.seedBar}>
            <div style={{
              ...styles.seedBarFill,
              width: `${((seedProgress.done + 1) / seedProgress.total) * 100}%`,
            }} />
          </div>
          <span style={styles.seedLabel}>
            Setting up your feeds… {seedProgress.name}
          </span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  resizeHandle: {
    width: 4,
    flexShrink: 0,
    cursor: 'col-resize',
    background: 'var(--border)',
    transition: 'background 150ms',
    zIndex: 10,
  },
  seedBanner: {
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 400,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-heavy)',
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 280,
  },
  seedBar: {
    height: 3,
    borderRadius: 2,
    background: 'var(--border)',
    overflow: 'hidden',
  },
  seedBarFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
    transition: 'width 400ms ease',
  },
  seedLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
};
