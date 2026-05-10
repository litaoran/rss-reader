# Context Menu & Rename Feature — Test Results

**Date:** 2025-05-09  
**Tester:** Claude (automated UI testing via computer-use)  
**App version:** v1.2.3 (dev build, uncommitted changes)  
**Platform:** macOS, Electron, Apple Silicon

---

## Summary

**12/12 tests passed.** All context menu and rename features work correctly.

---

## Test Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Feed context menu items | PASS | Shows: Mark all as read, Rename, Open feed URL, Remove feed. "Move to folder" successfully removed. |
| 2 | Feed rename — UI | PASS | Clicking "Rename" shows input pre-filled with current feed name, "Back" and "Save" buttons. Input is auto-focused. |
| 3 | Feed rename — save via Enter | PASS | Renamed "Dropbox Tech Blog" → "Dropbox Blog". Sidebar updated immediately, feed re-sorted alphabetically. |
| 4 | Feed rename — round trip | PASS | Renamed "Dropbox Blog" back to "Dropbox Tech Blog". Name persisted correctly in DB. |
| 5 | Folder context menu — menu first | PASS | Right-clicking folder header shows context menu with "Rename" option (not immediate rename input). |
| 6 | Folder rename — save via Enter | PASS | Renamed "Big Tech" → "FAANG". All feeds remained grouped under the renamed folder. |
| 7 | Folder rename — round trip | PASS | Renamed "FAANG" back to "Big Tech". Folder and all child feeds restored correctly. |
| 8 | Feed rename — Back button | PASS | "‹ Back" in rename view returns to main context menu without side effects. |
| 9 | Dismiss — click outside | PASS | Clicking outside the context menu dismisses it cleanly, no residual state. |
| 10 | Folder context menu — consistent UX | PASS | After UX fix: folder right-click now shows "Rename" menu item first (matching feed pattern), then rename input on click. |
| 11 | Cancel button — feed rename | PASS | Cancel button closes the entire context menu without saving. |
| 12 | Cancel button — folder rename | PASS | Cancel and Save buttons shown side by side in folder rename view. Cancel closes cleanly. |

---

## Changes Tested

- **Removed:** "Move to folder" from feed context menu (drag-and-drop covers this)
- **Added:** "Rename" option in feed context menu → shows inline rename input
- **Added:** Folder context menu (right-click folder header) → shows inline rename input
- **Backend:** `feeds:rename` and `feeds:renameFolder` IPC handlers, `renameFeed()` and `renameFeedFolder()` in db.ts

## Files Changed

- `src/components/FeedSidebar.tsx` — FeedContextMenu (removed folder view, added rename view), new FolderContextMenu component, discriminated union ContextMenu type
- `src/db.ts` — `renameFeed()`, `renameFeedFolder()`, `reorderFolders()`, `folderOrder` column
- `src/index.ts` — IPC handlers for `feeds:rename`, `feeds:renameFolder`, `feeds:reorderFolders`
- `src/preload.ts` — Exposed `feeds.rename()`, `feeds.renameFolder()`, `feeds.reorderFolders()`
- `src/window.d.ts` — Type declarations for new preload methods
- `src/App.tsx` — `handleReorderFolders`, passed `onReorderFolders` prop
