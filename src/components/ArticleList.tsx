import React, { useRef, useEffect } from 'react';
import { Article, ArticleWithContent } from '../types';

interface Props {
  articles: Article[];
  selectedArticle: ArticleWithContent | null;
  unreadOnly: boolean;
  newArticleNotice: { count: number } | null;
  onSelectArticle: (article: Article) => void;
  onToggleStar: (id: number) => void;
  onToggleUnreadOnly: () => void;
  onDismissNotice: () => void;
  onScrollToTop: () => void;
  width: number;
}

export function ArticleList({
  articles, selectedArticle, unreadOnly, newArticleNotice,
  onSelectArticle, onToggleStar, onToggleUnreadOnly, onDismissNotice, onScrollToTop, width,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = selectedArticle
    ? articles.findIndex(a => a.id === selectedArticle.id)
    : -1;

  // j/k keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'j' && selectedIndex < articles.length - 1) {
        onSelectArticle(articles[selectedIndex + 1]);
      }
      if (e.key === 'k' && selectedIndex > 0) {
        onSelectArticle(articles[selectedIndex - 1]);
      }
      if (e.key === 'b' && selectedArticle) {
        onToggleStar(selectedArticle.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex, articles, selectedArticle]);

  return (
    <div style={{ ...styles.container, width, minWidth: width }}>
      {/* Filter bar */}
      <div style={styles.filterBar}>
        <span style={styles.filterLabel}>
          {articles.length} {unreadOnly ? 'unread' : 'articles'}
        </span>
        <button
          style={{ ...styles.filterToggle, ...(unreadOnly ? styles.filterToggleActive : {}) }}
          onClick={onToggleUnreadOnly}
        >
          Unread only
        </button>
      </div>

      {/* New article pill */}
      {newArticleNotice && (
        <button style={styles.newPill} onClick={() => { onScrollToTop(); onDismissNotice(); }}>
          ↑ {newArticleNotice.count} new article{newArticleNotice.count !== 1 ? 's' : ''}
          <span style={styles.pillDismiss} onClick={(e) => { e.stopPropagation(); onDismissNotice(); }}>✕</span>
        </button>
      )}

      {/* Article rows */}
      <div ref={listRef} style={styles.list}>
        {articles.length === 0 ? (
          <EmptyState unreadOnly={unreadOnly} onToggleUnreadOnly={onToggleUnreadOnly} />
        ) : (
          articles.map(article => (
            <ArticleRow
              key={article.id}
              article={article}
              isSelected={selectedArticle?.id === article.id}
              onClick={() => onSelectArticle(article)}
              onToggleStar={() => onToggleStar(article.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ArticleRow({ article, isSelected, onClick, onToggleStar }: {
  article: Article;
  isSelected: boolean;
  onClick: () => void;
  onToggleStar: () => void;
}) {
  const ago = relativeTime(article.publishedAt);

  return (
    <button
      style={{
        ...styles.row,
        ...(isSelected ? styles.rowSelected : {}),
        opacity: article.isRead && !isSelected ? 0.7 : 1,
      }}
      onClick={onClick}
    >
      {!article.isRead && <span style={styles.unreadDot} />}
      <div style={styles.rowContent}>
        <div style={{
          ...styles.rowTitle,
          fontWeight: article.isRead ? 400 : 600,
          color: isSelected ? 'var(--selection-text)' : 'var(--text-primary)',
        }}>
          {article.title}
        </div>
        <div style={styles.rowMeta}>
          <span style={{ color: 'var(--text-secondary)', opacity: isSelected ? 0.8 : 1 }}>
            {article.feedName}
          </span>
          <span style={{ color: 'var(--text-tertiary)', opacity: isSelected ? 0.5 : 1 }}>·</span>
          <span style={{ color: 'var(--text-tertiary)', opacity: isSelected ? 0.5 : 1 }}>
            {ago}
          </span>
          {article.readTimeMin > 0 && (
            <>
              <span style={{ color: 'var(--text-tertiary)', opacity: isSelected ? 0.5 : 1 }}>·</span>
              <span style={{ color: 'var(--text-tertiary)', opacity: isSelected ? 0.5 : 1 }}>
                {article.readTimeMin}m
              </span>
            </>
          )}
        </div>
      </div>
      <button
        style={styles.starButton}
        onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
        title="Star (b)"
      >
        <span style={{ color: article.isStarred ? '#ffcc00' : 'var(--text-muted)', opacity: isSelected && !article.isStarred ? 0.5 : 1 }}>
          {article.isStarred ? '★' : '☆'}
        </span>
      </button>
    </button>
  );
}

function EmptyState({ unreadOnly, onToggleUnreadOnly }: {
  unreadOnly: boolean;
  onToggleUnreadOnly: () => void;
}) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>{unreadOnly ? '✓' : '📭'}</div>
      <div style={styles.emptyTitle}>
        {unreadOnly ? 'All caught up!' : 'No articles'}
      </div>
      {unreadOnly && (
        <button style={styles.emptyAction} onClick={onToggleUnreadOnly}>
          Show all articles
        </button>
      )}
    </div>
  );
}

function relativeTime(ms: number): string {
  if (!ms) return 'Date unknown';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 'var(--article-list-width)',
    minWidth: 'var(--article-list-width)',
    borderRight: 'none',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    gap: 8,
    flexShrink: 0,
  },
  filterLabel: {
    flex: 1,
    fontSize: 12,
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  filterToggle: {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 12,
    border: '1px solid var(--border-strong)',
    color: 'var(--text-secondary)',
    background: 'none',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  filterToggleActive: {
    background: 'var(--accent-subtle)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  newPill: {
    position: 'absolute',
    top: 52,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px',
    borderRadius: 20,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    boxShadow: 'var(--shadow-medium)',
    border: 'none',
    cursor: 'pointer',
    animation: 'slideDown 250ms ease',
  },
  pillDismiss: {
    fontSize: 10,
    opacity: 0.7,
    marginLeft: 2,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    padding: '10px 12px',
    gap: 8,
    border: 'none',
    boxShadow: 'inset 0 -1px 0 var(--border)',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 100ms',
    color: 'var(--text-primary)',
  },
  rowSelected: {
    background: 'var(--selection-bg)',
    boxShadow: 'none',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
    marginTop: 5,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as any,
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
  },
  starButton: {
    flexShrink: 0,
    fontSize: 14,
    padding: 2,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginTop: 1,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 8,
    color: 'var(--text-tertiary)',
    padding: 24,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' },
  emptyAction: {
    marginTop: 4,
    fontSize: 13,
    color: 'var(--accent)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
};
