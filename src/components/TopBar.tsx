import React from 'react';
import { RefreshProgress } from '../types';

interface Props {
  refreshProgress: RefreshProgress;
  onSearch: () => void;
}

export function TopBar({ refreshProgress, onSearch }: Props) {
  return (
    <div style={styles.bar}>
      <div style={styles.trafficLightSpacer} />

      <span style={styles.title}>RSS Reader</span>

      <div style={styles.actions}>
        {refreshProgress.isRefreshing && (
          <span style={styles.refreshingBadge}>
            <SpinIcon />
            Refreshing…
          </span>
        )}

        <button style={styles.iconButton} title="Search (⌘F)" onClick={onSearch}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <line x1="10" y1="10" x2="14" y2="14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SpinIcon() {
  return (
    <svg
      width="11" height="11"
      viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ animation: 'spin 1s linear infinite', display: 'block' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M8 2a6 6 0 1 0 6 6" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 'var(--topbar-height)',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    borderBottom: '1px solid var(--border)',
    WebkitAppRegion: 'drag',
    flexShrink: 0,
    gap: 8,
    background: 'var(--bg-sidebar)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  } as any,
  trafficLightSpacer: {
    width: 68,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '-0.01em',
    pointerEvents: 'none',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    WebkitAppRegion: 'no-drag',
  } as any,
  refreshingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: 'var(--text-secondary)',
    paddingRight: 4,
  },
  iconButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    transition: 'background 150ms',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
  },
};
