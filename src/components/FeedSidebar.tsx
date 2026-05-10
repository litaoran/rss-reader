import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  onMoveToFolder: (feedId: number, folder: string | null) => void;
  onReorderFolders: (folders: string[]) => void;
  width: number;
  updateReady: boolean;
  onRelaunch: () => void;
}

type ContextMenu = {
  type: 'feed';
  feedId: number;
  feedUrl: string;
  feedName: string;
  x: number;
  y: number;
} | {
  type: 'folder';
  folderName: string;
  x: number;
  y: number;
}

export function FeedSidebar({ feeds, selectedFeed, onSelectFeed, onMarkAllRead, onRemoveFeed, onAddFeed, onRefreshAll, isRefreshing, onMoveToFolder, onReorderFolders, width, updateReady, onRelaunch }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null | 'ungrouped'>(undefined as any);
  const [dragOverFolderTarget, setDragOverFolderTarget] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const dragFeedId = useRef<number | null>(null);
  const dragFolderName = useRef<string | null>(null);
  const totalUnread = feeds.reduce((sum, f) => sum + f.unreadCount, 0);

  useEffect(() => {
    window.rss.app.getVersion().then(setAppVersion);
  }, []);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, feedId: number, feedUrl: string, feedName: string) => {
    e.preventDefault();
    setContextMenu({ type: 'feed', feedId, feedUrl, feedName, x: e.clientX, y: e.clientY });
  }, []);

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folderName: string) => {
    e.preventDefault();
    setContextMenu({ type: 'folder', folderName, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleDragStart = useCallback((feedId: number) => {
    dragFeedId.current = feedId;
    dragFolderName.current = null;
  }, []);

  const handleFolderDragStart = useCallback((folderName: string) => {
    dragFolderName.current = folderName;
    dragFeedId.current = null;
  }, []);

  const handleDrop = useCallback((folder: string | null) => {
    if (dragFeedId.current !== null) {
      onMoveToFolder(dragFeedId.current, folder);
      dragFeedId.current = null;
    }
    setDragOverFolder(undefined as any);
  }, [onMoveToFolder]);

  const handleFolderDrop = useCallback((targetFolder: string) => {
    if (dragFolderName.current && dragFolderName.current !== targetFolder) {
      const folderNames = Array.from(grouped.keys());
      const fromIdx = folderNames.indexOf(dragFolderName.current);
      const toIdx = folderNames.indexOf(targetFolder);
      if (fromIdx !== -1 && toIdx !== -1) {
        const reordered = [...folderNames];
        reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, dragFolderName.current);
        onReorderFolders(reordered);
      }
      dragFolderName.current = null;
    }
    setDragOverFolderTarget(null);
  }, [grouped, onReorderFolders]);

  return (
    <div style={{ ...styles.sidebar, width, minWidth: width }}>
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
          icon={<InboxIcon />}
          label="All Items"
          count={totalUnread}
          isSelected={selectedFeed === 'all'}
          onClick={() => onSelectFeed('all')}
        />
        <SmartRow
          icon={<StarIcon />}
          label="Starred"
          count={0}
          isSelected={selectedFeed === 'starred'}
          onClick={() => onSelectFeed('starred')}
          hideCount
        />
        <SmartRow
          icon={<TodayIcon />}
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
        <div
          style={{ ...styles.section, ...(dragOverFolder === 'ungrouped' ? styles.dropTarget : {}) }}
          onDragOver={e => { e.preventDefault(); setDragOverFolder('ungrouped'); }}
          onDragLeave={() => setDragOverFolder(undefined as any)}
          onDrop={() => handleDrop(null)}
        >
          {ungrouped.map(feed => (
            <FeedRow
              key={feed.id}
              feed={feed}
              isSelected={selectedFeed === feed.id}
              onClick={() => onSelectFeed(feed.id)}
              onContextMenu={(e) => handleContextMenu(e, feed.id, feed.url, feed.name)}
              onDragStart={() => handleDragStart(feed.id)}
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
          onFolderContextMenu={handleFolderContextMenu}
          isDragOver={dragOverFolder === folder}
          isFolderDragOver={dragOverFolderTarget === folder}
          onDragOver={() => setDragOverFolder(folder)}
          onDragLeave={() => { setDragOverFolder(undefined as any); setDragOverFolderTarget(null); }}
          onDrop={() => handleDrop(folder)}
          onFeedDragStart={handleDragStart}
          onFolderDragStart={() => handleFolderDragStart(folder)}
          onFolderDragOver={() => setDragOverFolderTarget(folder)}
          onFolderDrop={() => handleFolderDrop(folder)}
        />
      ))}

      {feeds.length === 0 && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📡</div>
          <div style={styles.emptyText}>No feeds yet</div>
          <div style={styles.emptyHint}>Press <kbd>⌘N</kbd> to add one</div>
        </div>
      )}

      {updateReady ? (
        <div style={styles.updateBanner}>
          <span style={styles.updateText}>Update available</span>
          <button style={styles.updateButton} onClick={onRelaunch}>
            Relaunch
          </button>
        </div>
      ) : (
        <div style={styles.versionLabel}>v{appVersion}</div>
      )}

      {contextMenu?.type === 'feed' && (
        <FeedContextMenu
          feedId={contextMenu.feedId}
          feedUrl={contextMenu.feedUrl}
          feedName={contextMenu.feedName}
          x={contextMenu.x}
          y={contextMenu.y}
          onMarkAllRead={() => { onMarkAllRead(contextMenu.feedId); closeContextMenu(); }}
          onRemove={() => { onRemoveFeed(contextMenu.feedId); closeContextMenu(); }}
          onOpenUrl={() => { window.rss.shell.openExternal(contextMenu.feedUrl); closeContextMenu(); }}
          onRename={(name) => { window.rss.feeds.rename(contextMenu.feedId, name); closeContextMenu(); }}
          onClose={closeContextMenu}
        />
      )}
      {contextMenu?.type === 'folder' && (
        <FolderContextMenu
          folderName={contextMenu.folderName}
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={(newName) => { window.rss.feeds.renameFolder(contextMenu.folderName, newName); closeContextMenu(); }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function InboxIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
      <path d="M1.5 10h3.5l1.5 2.5h3L11 10h3.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.6l-3.6 1.9.7-4L2.2 5.7l4-.6z" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" />
      <line x1="5" y1="1" x2="5" y2="4" />
      <line x1="11" y1="1" x2="11" y2="4" />
      <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 3.5a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293L8.5 4.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1z" />
    </svg>
  );
}

// ─── Row Components ───────────────────────────────────────────────────────────

function SmartRow({ icon, label, count, isSelected, onClick, hideCount }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  hideCount?: boolean;
}) {
  return (
    <button style={{ ...styles.row, ...(isSelected ? styles.rowSelected : {}) }} onClick={onClick}>
      <span style={{ ...styles.iconSlot, color: isSelected ? 'var(--selection-badge)' : 'var(--accent)' }}>
        {icon}
      </span>
      <span style={styles.rowLabel}>{label}</span>
      {!hideCount && count > 0 && (
        <span style={{ ...styles.badge, ...(isSelected ? styles.badgeSelected : {}) }}>{count}</span>
      )}
    </button>
  );
}

function FeedFavicon({ faviconUrl, name, isStale }: { faviconUrl: string | null; name: string; isStale: boolean }) {
  const [failed, setFailed] = useState(false);
  const letter = name.charAt(0).toUpperCase();

  return (
    <span style={styles.faviconSlot}>
      {!failed && faviconUrl ? (
        <img
          src={faviconUrl}
          style={styles.favicon}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={styles.faviconFallback}>{letter}</span>
      )}
      {isStale && <span style={styles.staleIndicator} title="Feed hasn't updated in 7+ days" />}
    </span>
  );
}

function FeedRow({ feed, isSelected, onClick, onContextMenu, onDragStart, indented }: {
  feed: Feed;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  indented?: boolean;
}) {
  return (
    <button
      draggable
      style={{ ...styles.row, ...(isSelected ? styles.rowSelected : {}), ...(indented ? { paddingLeft: 18 } : {}) }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      title={feed.url}
    >
      <FeedFavicon faviconUrl={feed.faviconUrl} name={feed.name} isStale={feed.isStale} />
      <span style={styles.feedName}>{feed.name}</span>
      {feed.unreadCount > 0 && (
        <span style={{ ...styles.badge, ...(isSelected ? styles.badgeSelected : {}) }}>
          {feed.unreadCount}
        </span>
      )}
    </button>
  );
}

function FolderGroup({ name, feeds, selectedFeed, onSelectFeed, onContextMenu, onFolderContextMenu, isDragOver, isFolderDragOver, onDragOver, onDragLeave, onDrop, onFeedDragStart, onFolderDragStart, onFolderDragOver, onFolderDrop }: {
  name: string;
  feeds: Feed[];
  selectedFeed: SelectedFeed;
  onSelectFeed: (feed: SelectedFeed) => void;
  onContextMenu: (e: React.MouseEvent, feedId: number, feedUrl: string, feedName: string) => void;
  onFolderContextMenu: (e: React.MouseEvent, folderName: string) => void;
  isDragOver: boolean;
  isFolderDragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onFeedDragStart: (feedId: number) => void;
  onFolderDragStart: () => void;
  onFolderDragOver: () => void;
  onFolderDrop: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{ ...styles.section, ...(isDragOver ? styles.dropTarget : {}) }}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        draggable
        style={{ ...styles.folderHeader, ...(isFolderDragOver ? styles.folderDropTarget : {}) }}
        onClick={() => setCollapsed(!collapsed)}
        onDragStart={(e) => { e.stopPropagation(); onFolderDragStart(); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onFolderDragOver(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onFolderDrop(); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onFolderContextMenu(e, name); }}
      >
        <span style={{ ...styles.folderChevron, transform: collapsed ? 'none' : 'rotate(90deg)' }}>›</span>
        <FolderIcon />
        <span style={styles.folderName}>{name}</span>
      </div>
      {!collapsed && feeds.map(feed => (
        <FeedRow
          key={feed.id}
          feed={feed}
          isSelected={selectedFeed === feed.id}
          onClick={() => onSelectFeed(feed.id)}
          onContextMenu={(e) => onContextMenu(e, feed.id, feed.url, feed.name)}
          onDragStart={() => onFeedDragStart(feed.id)}
          indented
        />
      ))}
    </div>
  );
}

function FeedContextMenu({ feedId, feedUrl, feedName, x, y, onMarkAllRead, onRemove, onOpenUrl, onRename, onClose }: {
  feedId: number;
  feedUrl: string;
  feedName: string;
  x: number;
  y: number;
  onMarkAllRead: () => void;
  onRemove: () => void;
  onOpenUrl: () => void;
  onRename: (name: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'main' | 'rename'>('main');
  const [renameValue, setRenameValue] = useState(feedName);

  // Keep menu on-screen: clamp left so it doesn't overflow the right edge
  const menuWidth = 200;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);

  return createPortal(
    <>
      <div style={styles.contextOverlay} onClick={onClose} />
      <div style={{ ...styles.contextMenu, left: clampedX, top: y }} onClick={e => e.stopPropagation()}>
        {view === 'main' ? (
          <>
            <button style={styles.contextItem} onClick={onMarkAllRead}>Mark all as read</button>
            <button style={styles.contextItem} onClick={() => setView('rename')}>Rename</button>
            <button style={styles.contextItem} onClick={onOpenUrl}>Open feed URL</button>
            <div style={styles.contextDivider} />
            <button style={{ ...styles.contextItem, color: '#ff3b30' }} onClick={onRemove}>
              Remove feed
            </button>
          </>
        ) : (
          <div style={styles.contextNewFolder}>
            <input
              autoFocus
              style={styles.contextFolderInput}
              placeholder="Feed name…"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && renameValue.trim()) { if (renameValue.trim() !== feedName) onRename(renameValue.trim()); else onClose(); } if (e.key === 'Escape') onClose(); e.stopPropagation(); }}
            />
            <div style={styles.contextButtonRow}>
              <button
                style={{ ...styles.contextItem, color: 'var(--text-secondary)', paddingTop: 4, paddingBottom: 4, flex: 1, justifyContent: 'center' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.contextItem, color: 'var(--accent)', paddingTop: 4, paddingBottom: 4, flex: 1, justifyContent: 'center' }}
                onClick={() => { if (renameValue.trim() && renameValue.trim() !== feedName) onRename(renameValue.trim()); else onClose(); }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

function FolderContextMenu({ folderName, x, y, onRename, onClose }: {
  folderName: string;
  x: number;
  y: number;
  onRename: (newName: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'main' | 'rename'>('main');
  const [renameValue, setRenameValue] = useState(folderName);

  const menuWidth = 200;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);

  return createPortal(
    <>
      <div style={styles.contextOverlay} onClick={onClose} />
      <div style={{ ...styles.contextMenu, left: clampedX, top: y }} onClick={e => e.stopPropagation()}>
        {view === 'main' ? (
          <button style={styles.contextItem} onClick={() => setView('rename')}>Rename</button>
        ) : (
          <div style={styles.contextNewFolder}>
            <input
              autoFocus
              style={styles.contextFolderInput}
              placeholder="Folder name…"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && renameValue.trim()) { if (renameValue.trim() !== folderName) onRename(renameValue.trim()); else onClose(); } if (e.key === 'Escape') onClose(); e.stopPropagation(); }}
            />
            <div style={styles.contextButtonRow}>
              <button
                style={{ ...styles.contextItem, color: 'var(--text-secondary)', paddingTop: 4, paddingBottom: 4, flex: 1, justifyContent: 'center' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.contextItem, color: 'var(--accent)', paddingTop: 4, paddingBottom: 4, flex: 1, justifyContent: 'center' }}
                onClick={() => { if (renameValue.trim() && renameValue.trim() !== folderName) onRename(renameValue.trim()); else onClose(); }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    height: '100%',
    background: 'var(--bg-sidebar)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    borderRight: 'none',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
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
    padding: '0 8px',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '6px 12px',
  },
  // Every row: [iconSlot 20px] [label flex] [badge]
  row: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '4px 6px',
    borderRadius: 5,
    gap: 6,
    cursor: 'pointer',
    transition: 'background 100ms',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 13,
    textAlign: 'left',
    fontFamily: 'var(--font-ui)',
  },
  rowSelected: {
    background: 'var(--selection-bg)',
    color: 'var(--selection-text)',
  },
  // Fixed-width left column — keeps all labels at the same x
  iconSlot: {
    width: 20,
    height: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    minWidth: 20,
    textAlign: 'right',
    flexShrink: 0,
  },
  badgeSelected: {
    color: 'var(--selection-badge)',
  },
  faviconSlot: {
    position: 'relative',
    width: 16,
    height: 16,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  faviconFallback: {
    width: 16,
    height: 16,
    borderRadius: 3,
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  staleIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#ff3b30',
    border: '1.5px solid var(--bg-sidebar)',
  },
  // Folder section label — NOT a button-style row
  folderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '14px 6px 4px 6px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    userSelect: 'none',
  } as any,
  folderChevron: {
    fontSize: 12,
    lineHeight: 1,
    transition: 'transform 150ms',
    display: 'inline-block',
    color: 'var(--text-tertiary)',
    marginTop: -1,
  },
  folderName: {
    flex: 1,
  },
  folderDropTarget: {
    background: 'var(--accent-subtle)',
    borderRadius: 5,
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
  versionLabel: {
    marginTop: 'auto',
    flexShrink: 0,
    padding: '8px 12px',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    borderTop: '1px solid var(--border)',
  },
  updateBanner: {
    marginTop: 'auto',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
  },
  updateText: {
    flex: 1,
    fontSize: 11,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  updateButton: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 5,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  dropTarget: {
    borderRadius: 6,
    outline: '2px solid var(--accent)',
    outlineOffset: -2,
  },
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
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textAlign: 'left',
    transition: 'background 100ms',
    fontFamily: 'var(--font-ui)',
  },
  contextDivider: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
  contextNewFolder: {
    padding: '4px 8px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  contextButtonRow: {
    display: 'flex',
    gap: 4,
  },
  contextFolderInput: {
    width: '100%',
    padding: '5px 8px',
    fontSize: 12,
    borderRadius: 5,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
