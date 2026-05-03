import React, { useState, useCallback } from 'react';
import { Feed, SelectedFeed } from '../types';

interface Props {
  feeds: Feed[];
  selectedFeed: SelectedFeed;
  onSelectFeed: (feed: SelectedFeed) => void;
  onMarkAllRead: (feedId: number) => void;
  onRemoveFeed: (feedId: number) => void;
  onAddFeed: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}

interface ContextMenu {
  feedId: number;
  x: number;
  y: number;
}

export function FeedSidebar({ feeds, selectedFeed, onSelectFeed, onMarkAllRead, onRemoveFeed, onAddFeed, onRefreshAll, isRefreshing }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const totalUnread = feeds.reduce((sum, f) => sum + f.unreadCount, 0);

  // Group feeds by folder
  const grouped = new Map<string, Feed[]>();
  const ungrouped: Feed[] = [];
  for (const feed of feeds) {
    if (feed.folder) {
      const g = grouped.get(feed.folder) ?? [];
      g.push(feed);
      grouped.set(feed.folder, g);
    } else {
      ungrouped.push(feed);
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, feedId: number) => {
    e.preventDefault();
    setContextMenu({ feedId, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div style={styles.sidebar} onClick={closeContextMenu}>
      {/* Action row */}
      <div style={styles.actionRow}>
        <button style={styles.addButton} onClick={onAddFeed} title="Add feed (⌘N)">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          Add Feed
        </button>
        <button
          style={styles.refreshButton}
          onClick={onRefreshAll}
          title="Refresh all (⌘⇧R)"
          disabled={isRefreshing}
        >
          <svg
            width="13" height="13" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            style={isRefreshing ? { animation: 'spin 1s linear infinite' } : undefined}
          >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <path d="M13.5 2.5A6.5 6.5 0 1 1 2 8.5" />
            <polyline points="1,5 2,8.5 5.5,7.5" />
          </svg>
        </button>
      </div>

      {/* Smart rows */}
      <div style={{ ...styles.section, marginTop: 6 }}>
        <SmartRow
          icon="●"
          label="All Items"
          count={totalUnread}
          isSelected={selectedFeed === 'all'}
          onClick={() => onSelectFeed('all')}
        />
        <SmartRow
          icon="★"
          label="Starred"
          count={0}
          isSelected={selectedFeed === 'starred'}
          onClick={() => onSelectFeed('starred')}
          hideCount
        />
        <SmartRow
          icon="◷"
          label="Today"
          count={0}
          isSelected={selectedFeed === 'today'}
          onClick={() => onSelectFeed('today')}
          hideCount
        />
      </div>

      <div style={styles.divider} />

      {/* Ungrouped feeds */}
      {ungrouped.length > 0 && (
        <div style={styles.section}>
          {ungrouped.map(feed => (
            <FeedRow
              key={feed.id}
              feed={feed}
              isSelected={selectedFeed === feed.id}
              onClick={() => onSelectFeed(feed.id)}
              onContextMenu={(e) => handleContextMenu(e, feed.id)}
            />
          ))}
        </div>
      )}

      {/* Grouped feeds */}
      {Array.from(grouped.entries()).map(([folder, groupFeeds]) => (
        <FolderGroup
          key={folder}
          name={folder}
          feeds={groupFeeds}
          selectedFeed={selectedFeed}
          onSelectFeed={onSelectFeed}
          onContextMenu={handleContextMenu}
        />
      ))}

      {feeds.length === 0 && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📡</div>
          <div style={styles.emptyText}>No feeds yet</div>
          <div style={styles.emptyHint}>Press <kbd>⌘N</kbd> to add one</div>
        </div>
      )}

      {contextMenu && (
        <FeedContextMenu
          feedId={contextMenu.feedId}
          x={contextMenu.x}
          y={contextMenu.y}
          onMarkAllRead={() => { onMarkAllRead(contextMenu.feedId); closeContextMenu(); }}
          onRemove={() => { onRemoveFeed(contextMenu.feedId); closeContextMenu(); }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

function SmartRow({ icon, label, count, isSelected, onClick, hideCount }: {
  icon: string;
  label: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  hideCount?: boolean;
}) {
  return (
    <button style={{ ...styles.row, ...(isSelected ? styles.rowSelected : {}) }} onClick={onClick}>
      <span style={styles.smartIcon}>{icon}</span>
      <span style={styles.rowLabel}>{label}</span>
      {!hideCount && count > 0 && <span style={styles.badge}>{count}</span>}
    </button>
  );
}

function FeedRow({ feed, isSelected, onClick, onContextMenu }: {
  feed: Feed;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      style={{ ...styles.row, ...(isSelected ? styles.rowSelected : {}) }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={feed.url}
    >
      {feed.isStale && <span style={styles.staleIndicator} title="Feed hasn't updated in 7+ days" />}
      <span style={styles.feedName}>{feed.name}</span>
      {feed.unreadCount > 0 && (
        <span style={{ ...styles.badge, ...(isSelected ? styles.badgeSelected : {}) }}>
          {feed.unreadCount}
        </span>
      )}
    </button>
  );
}

function FolderGroup({ name, feeds, selectedFeed, onSelectFeed, onContextMenu }: {
  name: string;
  feeds: Feed[];
  selectedFeed: SelectedFeed;
  onSelectFeed: (feed: SelectedFeed) => void;
  onContextMenu: (e: React.MouseEvent, feedId: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={styles.section}>
      <button style={styles.folderHeader} onClick={() => setCollapsed(!collapsed)}>
        <span style={{ ...styles.folderChevron, transform: collapsed ? 'none' : 'rotate(90deg)' }}>▶</span>
        <span style={styles.folderName}>{name}</span>
      </button>
      {!collapsed && feeds.map(feed => (
        <FeedRow
          key={feed.id}
          feed={feed}
          isSelected={selectedFeed === feed.id}
          onClick={() => onSelectFeed(feed.id)}
          onContextMenu={(e) => onContextMenu(e, feed.id)}
        />
      ))}
    </div>
  );
}

function FeedContextMenu({ feedId, x, y, onMarkAllRead, onRemove, onClose }: {
  feedId: number;
  x: number;
  y: number;
  onMarkAllRead: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div style={styles.contextOverlay} onClick={onClose} />
      <div style={{ ...styles.contextMenu, left: x, top: y }}>
        <button style={styles.contextItem} onClick={onMarkAllRead}>Mark all as read</button>
        <div style={styles.contextDivider} />
        <button style={{ ...styles.contextItem, color: '#ff3b30' }} onClick={onRemove}>
          Remove feed
        </button>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    height: '100%',
    background: 'var(--bg-sidebar)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    borderRight: '1px solid var(--border)',
    overflowY: 'auto',
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    position: 'relative',
  } as any,
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  addButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 6,
    background: 'var(--accent-subtle)',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid rgba(0, 122, 255, 0.2)',
    fontFamily: 'var(--font-ui)',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 150ms',
  },
  section: {
    padding: '2px 8px',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '6px 12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '5px 8px',
    borderRadius: 6,
    gap: 7,
    cursor: 'pointer',
    transition: 'background 100ms',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 13,
    textAlign: 'left',
  },
  rowSelected: {
    background: 'var(--selection-bg)',
    color: 'var(--selection-text)',
  },
  smartIcon: {
    fontSize: 11,
    color: 'var(--accent)',
    width: 14,
    textAlign: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },
  feedName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    minWidth: 18,
    textAlign: 'right',
    flexShrink: 0,
  },
  badgeSelected: {
    color: 'var(--selection-badge)',
  },
  staleIndicator: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#ff3b30',
    flexShrink: 0,
    display: 'inline-block',
  },
  folderHeader: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '4px 8px',
    borderRadius: 6,
    gap: 6,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  folderChevron: {
    fontSize: 8,
    transition: 'transform 150ms',
    display: 'inline-block',
  },
  folderName: {
    flex: 1,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 24,
    color: 'var(--text-tertiary)',
    marginTop: 40,
  },
  emptyIcon: { fontSize: 28 },
  emptyText: { fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' },
  emptyHint: { fontSize: 12, color: 'var(--text-tertiary)' },
  contextOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99,
  },
  contextMenu: {
    position: 'fixed',
    zIndex: 100,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-heavy)',
    padding: '4px 0',
    minWidth: 160,
  },
  contextItem: {
    display: 'block',
    width: '100%',
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textAlign: 'left',
    transition: 'background 100ms',
  },
  contextDivider: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
};
