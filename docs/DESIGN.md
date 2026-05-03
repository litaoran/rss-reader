# RSS Reader — UX Design Plan

## Context

Building a macOS-native RSS reader focused on **engineering blogs**. The primary workflow is: subscribe to feeds → track unread articles per source → read at your own pace → auto-refresh in the background. Tech stack: React + Electron with macOS-native visual design.

---

## Layout: Three-Pane with Top Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│ ● ● ●   RSS Reader          [⟳ Refreshing…]          [🔍] [+ Add]  │  ← Top bar (50px, draggable)
├─────────────────┬───────────────────────┬───────────────────────────┤
│  FEEDS          │  ARTICLES             │  READING VIEW             │
│  200-240px      │  280-320px            │  flex: 1                  │
│                 │                       │                           │
│  All Items  47  │  ● New article title  │  # Article headline       │
│  ⭐ Starred   3 │    The Verge · 2h ago │                           │
│  ─────────────  │                       │  The Verge · May 2, 2026  │
│  Engineering    │  ● Another post here  │  ✦ 6 min read             │
│  ▸ The Verge  12│    Ars Technica · 4h  │                           │
│  ▸ Ars Tech.   8│                       │  [article body, clean     │
│  ▸ HN Blog     5│  ✓ Older read article │   typography, no clutter] │
│  ▸ Dan Luu    21│    Dan Luu · yesterday│                           │
│  ─────────────  │                       │                           │
│  [+ Add Feed]   │                       │  [⭐ Star]  [↗ Open]     │
└─────────────────┴───────────────────────┴───────────────────────────┘
```

---

## Core Features & UX Decisions

### 1. Feed Sidebar (Left Pane)
- **Smart rows at top**: "All Items" (total unread), "⭐ Starred", "Today" (articles from last 24h)
- **Feed groups/folders**: Collapsible sections (e.g., "Engineering", "News") — drag to reorder
- **Per-feed unread count**: Bold number badge on the right; disappears when all read
- **Feed health indicator**: Subtle red dot if a feed hasn't updated in 7+ days (likely dead)
- **Right-click context menu**: Rename, Mark all as read, Open feed URL, Remove feed

### 2. Article List (Middle Pane)
- **Unread vs. read**: Unread = bold title + filled circle indicator; read = muted, no circle
- **Metadata line**: Source name · relative time (e.g., "2h ago") · estimated read time
- **Density toggle**: Compact (title only) vs. Comfortable (title + first line of body)
- **Filter bar**: "Unread only" toggle — default ON so the list stays focused
- **Mark as read on open**: Clicking an article immediately marks it read (optimistic UI)
- **Keyboard nav**: `j`/`k` to move through list, `Enter` to open, `m` to toggle read, `b` to star

### 3. Reading View (Right Pane)
- **Clean reader mode**: Strip ads/nav, reformat to readable typography (like Safari Reader)
- **Progress tracking**: A thin progress bar at the top of the pane tracks scroll depth — persisted per article so you can return mid-way
- **Reading time estimate**: Shown under the headline ("✦ 6 min read")
- **Action strip (bottom)**: [⭐ Star] [↗ Open in Browser] [← Prev] [→ Next]
- **Empty state**: When no article is selected, show keyboard shortcuts cheatsheet

### 4. Auto-Refresh & Progress Tracking
- **Background polling**: Configurable interval (default: every 15 min) using Electron's background process
- **Refresh indicator**: Subtle spinning icon in top bar while fetching; no modal/blocking UI
- **New article badge**: Unread counts update live; a "↑ 3 new" pill appears above the article list if new items arrived while you were reading — tap to jump to top
- **Last fetched timestamp**: Shown in sidebar tooltip on hover over each feed name
- **Manual refresh**: `⌘R` refreshes current feed; `⌘⇧R` refreshes all feeds

### 5. Search
- **Trigger**: `⌘F` — opens a floating search bar that overlays the article list pane
- **Scope**: Searches title + body across all fetched articles
- **Live results**: Updates as you type (debounced 200ms)
- **Result context**: Shows feed source + date under each result
- **Dismiss**: `Escape` returns to previous view

### 6. Starred / Saved Articles
- **Star via**: `b` keyboard shortcut, or click ⭐ in reading view
- **Starred feed**: Appears as a smart row in sidebar; persisted locally
- **Visual**: Gold star icon in article list row when starred

### 7. Add Feed Flow
- Click `+ Add` in top bar or press `⌘N`
- A small sheet drops down with a URL input field
- On submit: auto-discover the RSS feed URL (try `/feed`, `/rss`, `/atom.xml` etc.)
- Preview the feed name + article count before confirming
- Option to assign to a folder on the same sheet

---

## Additional Features (Suggested)

| Feature | Why it matters |
|---|---|
| **Reading streak / stats** | Gamification — shows articles read this week per source, keeps engagement |
| **"Continue reading" section** | Articles you scrolled past 20% but didn't finish — resurface them |
| **Font/size controls** | Engineering readers often prefer dense or large type |
| **OPML import/export** | Standard RSS format — lets users migrate from Reeder, NetNewsWire etc. |
| **System notifications** | Optional: notify when a specific feed (e.g. a company's engineering blog) posts |
| **Link previews on hover** | Hovering a link in reading view shows a popover preview |

---

## Visual Design Principles (from macos-design skill)

- **Light + Dark**: Full CSS variable system, both modes designed independently
- **Vibrancy**: Sidebar uses `backdrop-filter: saturate(180%) blur(20px)` with translucent bg
- **Typography**: `-apple-system, "SF Pro Text"` · 13px body · -0.01em letter-spacing
- **Accent color**: Used only for unread indicators and active selection — nowhere else
- **Shadows**: Layered subtle shadows (no single heavy drop shadow)
- **Radius**: Window 10px · cards 8px · buttons 6px · inputs 4px

---

## Interaction Keyboard Map

| Shortcut | Action |
|---|---|
| `j` / `k` | Next / previous article |
| `m` | Toggle read/unread |
| `b` | Toggle starred |
| `⌘R` | Refresh current feed |
| `⌘⇧R` | Refresh all feeds |
| `⌘F` | Open search |
| `⌘N` | Add new feed |
| `⌘1–9` | Jump to feed by position |
| `Escape` | Close panel / dismiss search |
| `Space` | Scroll article down |

---

## Implementation Approach

**Phase 1 — Scaffold & Shell**
1. `npx create-electron-app rss-reader --template=webpack-typescript`
2. Set up React + Tailwind (or CSS modules) inside the renderer
3. Build the three-pane layout shell with traffic lights + drag region

**Phase 2 — Data Layer**
4. Electron main process: SQLite (via `better-sqlite3`) for articles, feeds, read state, starred
5. Feed fetcher service: `rss-parser` npm package, runs on interval in main process
6. IPC bridge: renderer subscribes to feed updates via `ipcRenderer.on`

**Phase 3 — UI Components**
7. FeedSidebar, ArticleList, ReadingPane components
8. Reader mode: `@mozilla/readability` to clean article HTML
9. Search: SQLite FTS5 full-text search index

**Phase 4 — Polish**
10. Keyboard shortcut system
11. Light/dark mode CSS variables
12. Onboarding modal (teaches `j/k` and `⌘R` by doing)
13. OPML import

---

## Critical Files (to be created)

- `src/main/index.ts` — Electron main process, feed scheduler, IPC handlers
- `src/main/db.ts` — SQLite schema and queries
- `src/main/fetcher.ts` — RSS fetch + parse + diff logic
- `src/renderer/App.tsx` — Three-pane shell
- `src/renderer/components/FeedSidebar.tsx`
- `src/renderer/components/ArticleList.tsx`
- `src/renderer/components/ReadingPane.tsx`
- `src/renderer/styles/variables.css` — Light/dark CSS variables

---

## Verification

1. Launch app: three panes render, traffic lights present, window draggable from top bar
2. Add an engineering blog feed (e.g. `https://engineering.atspotify.com/feed/`) — it appears in sidebar with article count
3. Unread articles show bold; clicking marks as read (count decrements)
4. `⌘⇧R` triggers refresh; spinner appears in top bar, new articles prepend to list
5. `⌘F` opens search; typing filters articles live
6. Star an article with `b`; it appears in Starred smart feed
7. Toggle dark mode in System Settings — app switches automatically
