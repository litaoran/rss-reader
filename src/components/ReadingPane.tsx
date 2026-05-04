import React, { useEffect, useRef, useCallback, useState } from 'react';
import { ArticleWithContent } from '../types';

interface Props {
  article: ArticleWithContent | null;
  onToggleStar: (id: number) => void;
  onOpenExternal: (url: string) => void;
  onProgress: (id: number, progress: number) => void;
}

export function ReadingPane({ article, onToggleStar, onOpenExternal, onProgress }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [isFetchingContent, setIsFetchingContent] = useState(false);

  // When an article with no content is opened, fetch it on demand
  useEffect(() => {
    setFetchedContent(null);
    if (!article || article.content) return;

    setIsFetchingContent(true);
    window.rss.articles.fetchContent(article.id).then((html: string | null) => {
      setFetchedContent(html || '');
      setIsFetchingContent(false);
    }).catch(() => {
      setFetchedContent('');
      setIsFetchingContent(false);
    });
  }, [article?.id]);

  // Restore scroll position and save progress on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !article) return;

    el.scrollTop = article.scrollProgress * (el.scrollHeight - el.clientHeight);

    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const progress = max > 0 ? el.scrollTop / max : 0;
      progressRef.current = progress;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onProgress(article.id, progress);
      }, 800);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [article?.id]);

  const progressPercent = article ? article.scrollProgress * 100 : 0;

  if (!article) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyInner}>
          <div style={styles.emptyIcon}>📖</div>
          <div style={styles.emptyTitle}>Select an article to read</div>
          <div style={styles.shortcuts}>
            <ShortcutRow keys={['j', 'k']} label="Navigate articles" />
            <ShortcutRow keys={['⌘F']} label="Search" />
            <ShortcutRow keys={['⌘N']} label="Add feed" />
            <ShortcutRow keys={['b']} label="Star article" />
            <ShortcutRow keys={['⌘R']} label="Refresh current feed" />
            <ShortcutRow keys={['⌘⇧R']} label="Refresh all feeds" />
          </div>
        </div>
      </div>
    );
  }

  const pubDate = new Date(article.publishedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={styles.pane}>
      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${progressPercent}%` }} />
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} style={styles.scroll}>
        <div style={styles.content}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.feedMeta}>
              <span style={styles.feedName}>{article.feedName}</span>
              <span style={styles.dot}>·</span>
              <span style={styles.pubDate}>{pubDate}</span>
              {article.readTimeMin > 0 && (
                <>
                  <span style={styles.dot}>·</span>
                  <span style={styles.readTime}>✦ {article.readTimeMin} min read</span>
                </>
              )}
            </div>
            <h1
              style={{ ...styles.title, cursor: 'pointer' }}
              onClick={() => onOpenExternal(article.url)}
              title={article.url}
            >
              {article.title} <span style={{ fontSize: '0.5em', verticalAlign: 'middle', opacity: 0.4 }}>↗</span>
            </h1>
            {article.author && (
              <div style={styles.author}>by {article.author}</div>
            )}
          </div>

          {/* Body */}
          <div
            style={styles.body}
            dangerouslySetInnerHTML={{ __html:
              isFetchingContent
                ? '<p style="color:var(--text-tertiary)">Loading article…</p>'
                : sanitize(article.content || fetchedContent || article.summary || '<p>No content available.</p>')
            }}
          />
        </div>
      </div>

      {/* Action strip */}
      <div style={styles.actions}>
        <button
          style={styles.actionButton}
          onClick={() => onToggleStar(article.id)}
          title="Star (b)"
        >
          <span style={{ color: article.isStarred ? '#ffcc00' : 'var(--text-secondary)' }}>
            {article.isStarred ? '★' : '☆'}
          </span>
          {article.isStarred ? 'Starred' : 'Star'}
        </button>
        <button
          style={styles.actionButton}
          onClick={() => onOpenExternal(article.url)}
          title="Open in browser"
        >
          <span>↗</span>
          Open in Browser
        </button>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div style={shortcutStyles.row}>
      <div style={shortcutStyles.keys}>
        {keys.map(k => <kbd key={k}>{k}</kbd>)}
      </div>
      <span style={shortcutStyles.label}>{label}</span>
    </div>
  );
}

function sanitize(html: string): string {
  // Strip script tags and dangerous attributes for basic safety
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '');
}

const shortcutStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 0',
  },
  keys: {
    display: 'flex',
    gap: 4,
    minWidth: 80,
    justifyContent: 'flex-end',
  },
  label: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
};

const styles: Record<string, React.CSSProperties> = {
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    color: 'var(--text-tertiary)',
  },
  emptyInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 },
  shortcuts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    padding: '16px 24px',
    borderRadius: 10,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
  },
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    background: 'var(--border)',
    flexShrink: 0,
  },
  progressBar: {
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 300ms ease',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  content: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '40px 48px 60px',
  },
  header: {
    marginBottom: 32,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 24,
  },
  feedMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    fontSize: 12,
  },
  feedName: {
    color: 'var(--accent)',
    fontWeight: 500,
  },
  dot: {
    color: 'var(--text-muted)',
  },
  pubDate: {
    color: 'var(--text-secondary)',
  },
  readTime: {
    color: 'var(--text-tertiary)',
  },
  title: {
    fontSize: 26,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
    marginBottom: 10,
  },
  author: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  body: {
    fontSize: 16,
    lineHeight: 1.75,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-reading)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 24px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 16px',
    borderRadius: 8,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 150ms',
    fontFamily: 'var(--font-ui)',
  },
};
