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

  // When an article with no/stub content is opened, fetch full text on demand.
  // The generic scraper may store a short summary as "content" — treat anything
  // under 200 chars as incomplete so we still fetch the real article.
  useEffect(() => {
    setFetchedContent(null);
    if (!article || (article.content && article.content.length > 200)) return;

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

  const pubDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

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
              <span style={styles.pubDate}>{pubDate ?? 'Date unknown'}</span>
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
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {article.title} <span style={{ fontSize: '0.5em', verticalAlign: 'middle', opacity: 0.4 }}>↗</span>
            </h1>
            {article.author && (
              <div style={styles.author}>by {article.author}</div>
            )}
          </div>

          {/* Body */}
          <div
            className="article-body"
            style={styles.body}
            dangerouslySetInnerHTML={{ __html:
              isFetchingContent
                ? '<p style="color:var(--text-tertiary)">Loading article…</p>'
                : sanitize(
                    article.content || fetchedContent || article.summary || '<p>No content available.</p>',
                    article.url,
                  )
            }}
          />
        </div>
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

function sanitize(html: string, baseUrl?: string): string {
  let result = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '');

  // Resolve relative URLs in src and href attributes using the article URL as base
  if (baseUrl) {
    try {
      const base = new URL(baseUrl);
      // Fix img src and add referrerpolicy="no-referrer" to avoid hotlink protection rejections
      result = result.replace(/(<img)([^>]+src=["'])([^"']+)(["'])/gi, (_, tag, pre, src, post) => {
        try {
          const resolved = new URL(src, base).href;
          return `${tag} referrerpolicy="no-referrer"${pre}${resolved}${post}`;
        } catch { return `${tag} referrerpolicy="no-referrer"${pre}${src}${post}`; }
      });
      // Fix srcset
      result = result.replace(/(<img[^>]+srcset=["'])([^"']+)(["'])/gi, (_, pre, srcset, post) => {
        const fixed = srcset.replace(/([^\s,]+)(\s*(?:\d+[wx])?\s*(?:,|$))/g, (m: string, u: string, rest: string) => {
          try { return new URL(u, base).href + rest; } catch { return m; }
        });
        return pre + fixed + post;
      });
    } catch {}
  }

  return result;
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
    maxWidth: 620,           /* tighter column — less wall-of-text */
    margin: '0 auto',
    padding: '36px 40px 60px',
  },
  header: {
    marginBottom: 28,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 20,
  },
  feedMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.01em',
    textTransform: 'uppercase' as const,
  },
  feedName: {
    color: 'var(--accent)',
    fontWeight: 600,
  },
  dot: {
    color: 'var(--text-muted)',
    fontWeight: 400,
    textTransform: 'none' as const,
  },
  pubDate: {
    color: 'var(--text-secondary)',
    fontWeight: 400,
    textTransform: 'none' as const,
  },
  readTime: {
    color: 'var(--text-tertiary)',
    fontWeight: 400,
    textTransform: 'none' as const,
  },
  title: {
    fontSize: 28,             /* bigger, stronger title */
    fontFamily: 'var(--font-display)',
    fontWeight: 800,          /* heavier weight for hierarchy contrast */
    lineHeight: 1.2,
    letterSpacing: '-0.025em',
    color: 'var(--text-primary)',
    marginBottom: 8,
  },
  author: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginTop: 6,
  },
  body: {
    // Typography handled by .article-body CSS class
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
