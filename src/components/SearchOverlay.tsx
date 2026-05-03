import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Article } from '../types';

interface Props {
  onClose: () => void;
  onSelectArticle: (article: Article) => void;
}

export function SearchOverlay({ onClose, onSelectArticle }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await window.rss.articles.search(q.trim());
      setResults(res);
      setSelectedIndex(0);
    }, 200);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[selectedIndex]) {
      onSelectArticle(results[selectedIndex]);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={styles.inputRow}>
          <svg style={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <line x1="10" y1="10" x2="14" y2="14" />
          </svg>
          <input
            ref={inputRef}
            style={styles.input}
            placeholder="Search articles…"
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          />
          <kbd style={styles.escHint}>Esc</kbd>
        </div>

        {results.length > 0 && (
          <div style={styles.results}>
            {results.map((article, i) => (
              <button
                key={article.id}
                style={{ ...styles.result, ...(i === selectedIndex ? styles.resultSelected : {}) }}
                onClick={() => onSelectArticle(article)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div style={styles.resultTitle}>{article.title}</div>
                <div style={styles.resultMeta}>
                  <span>{article.feedName}</span>
                  <span>·</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div style={styles.noResults}>No articles found for "{query}"</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 120,
  } as any,
  panel: {
    width: 560,
    background: 'var(--bg-elevated)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-heavy)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    gap: 10,
    borderBottom: '1px solid var(--border)',
  },
  searchIcon: {
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
  },
  escHint: {
    flexShrink: 0,
  },
  results: {
    maxHeight: 400,
    overflowY: 'auto',
    padding: '4px 0',
  },
  result: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: 0,
    transition: 'background 100ms',
  },
  resultSelected: {
    background: 'var(--accent-subtle)',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultMeta: {
    display: 'flex',
    gap: 5,
    fontSize: 11,
    color: 'var(--text-tertiary)',
  },
  noResults: {
    padding: '20px 16px',
    fontSize: 13,
    color: 'var(--text-tertiary)',
    textAlign: 'center',
  },
};
