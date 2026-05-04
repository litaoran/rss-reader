import React, { useState, useRef, useEffect } from 'react';
import { Feed, FeedDiscovery } from '../types';

interface Props {
  onClose: () => void;
  onAdded: (feeds: Feed[]) => void;
  existingFolders: string[];
}

type Step = 'input' | 'preview' | 'loading' | 'error';

export function AddFeedSheet({ onClose, onAdded, existingFolders }: Props) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [discovery, setDiscovery] = useState<FeedDiscovery | null>(null);
  const [error, setError] = useState('');
  const [folder, setFolder] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleDiscover() {
    if (!url.trim()) return;
    setStep('loading');
    setError('');
    try {
      const result = await window.rss.feeds.discover(url.trim());
      setDiscovery(result);
      setStep('preview');
    } catch (e: any) {
      setError(e?.message || 'Could not find an RSS feed at that URL');
      setStep('error');
    }
  }

  async function handleAdd() {
    if (!discovery) return;
    setStep('loading');
    try {
      const feeds = await window.rss.feeds.add(
        discovery.feedUrl,
        discovery.name,
        folder.trim() || null
      );
      onAdded(feeds);
    } catch (e: any) {
      setError(e?.message || 'Failed to add feed');
      setStep('error');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'input' || step === 'error') handleDiscover();
      if (step === 'preview') handleAdd();
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={styles.header}>
          <div style={styles.title}>Add RSS Feed</div>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <div style={styles.field}>
            <label style={styles.label}>Feed or website URL</label>
            <input
              ref={inputRef}
              style={styles.input}
              type="url"
              placeholder="https://example.com/feed"
              value={url}
              onChange={e => { setUrl(e.target.value); setStep('input'); setError(''); }}
            />
          </div>

          {step === 'loading' && (
            <div style={styles.loading}>Looking up feed…</div>
          )}

          {step === 'error' && (
            <div style={styles.error}>{error}</div>
          )}

          {step === 'preview' && discovery && (
            <div style={styles.preview}>
              <div style={styles.previewName}>{discovery.name}</div>
              <div style={styles.previewMeta}>
                {discovery.articleCount} recent article{discovery.articleCount !== 1 ? 's' : ''}
              </div>
              <div style={styles.previewUrl}>{discovery.feedUrl}</div>

              <div style={styles.field}>
                <label style={styles.label}>Folder (optional)</label>
                {existingFolders.length > 0 && (
                  <div style={styles.folderChips}>
                    {existingFolders.map(f => (
                      <button
                        key={f}
                        style={{ ...styles.chip, ...(folder === f ? styles.chipSelected : {}) }}
                        onClick={() => setFolder(folder === f ? '' : f)}
                        type="button"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Or type a new folder name…"
                  value={folder}
                  onChange={e => setFolder(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>Cancel</button>
          {step !== 'preview' ? (
            <button
              style={{ ...styles.primaryButton, opacity: url.trim() ? 1 : 0.5 }}
              onClick={handleDiscover}
              disabled={!url.trim() || step === 'loading'}
            >
              Find Feed
            </button>
          ) : (
            <button style={styles.primaryButton} onClick={handleAdd}>
              Add Feed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 'var(--topbar-height)',
  } as any,
  sheet: {
    width: 440,
    background: 'var(--bg-elevated)',
    borderRadius: '0 0 12px 12px',
    boxShadow: 'var(--shadow-heavy)',
    border: '1px solid var(--border)',
    borderTop: 'none',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeButton: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    color: 'var(--text-tertiary)',
    fontSize: 12,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
  },
  body: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 150ms',
    width: '100%',
  },
  folderChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  } as React.CSSProperties,
  chip: {
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    transition: 'all 100ms',
  },
  chipSelected: {
    background: 'var(--accent-subtle)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  loading: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    padding: '4px 0',
  },
  error: {
    fontSize: 13,
    color: '#ff3b30',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'rgba(255,59,48,0.08)',
    border: '1px solid rgba(255,59,48,0.2)',
  },
  preview: {
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  previewName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  previewMeta: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  previewUrl: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 4,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
  },
  cancelButton: {
    padding: '7px 16px',
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  primaryButton: {
    padding: '7px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    transition: 'opacity 150ms',
  },
};
