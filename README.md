# Antenna

**Your daily read, curated for engineers.**

A macOS RSS reader built for engineering blogs. Three-pane layout, permanent article archive, full-text search, and a curated starter set so you don't begin from scratch.

![Antenna screenshot](docs/screenshot.png)

## Download

**macOS (Apple Silicon / M-series):** [Antenna-darwin-arm64-1.0.0.zip](https://github.com/litaoran/rss-reader/releases/latest)

Unzip, drag `Antenna.app` to `/Applications`, open.

> **First launch security prompt:** macOS blocks unsigned apps. Right-click `Antenna.app` → **Open** → **Open** to run it once; subsequent launches work normally.

> **Note:** This build is arm64 only (Apple Silicon). Intel Mac support is not available yet.

## Features

- **Pre-loaded feeds** — 6 curated engineering sources across three folders, so you're not starting from an empty reader
- **Permanent archive** — every article ever fetched is kept; nothing is deleted
- **Full-text search** — ⌘F searches titles and body across your entire history
- **Reading progress** — scroll position is saved per article so you can pick up where you left off
- **Auto-refresh** — feeds update every 15 minutes in the background
- **Today / Starred / Unread views** — smart rows in the sidebar for fast triage
- **Auto-updates** — the app checks for new releases on GitHub automatically

## Default Feeds

| Folder | Feed |
|---|---|
| Aggregators | Hacker News (front page) |
| Big Tech | Cloudflare Blog |
| Big Tech | Netflix Tech Blog |
| Big Tech | Stripe Engineering |
| Individual Engineers | Martin Fowler |
| Individual Engineers | The Pragmatic Engineer |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `j` / `k` | Next / previous article |
| `b` | Toggle star |
| `m` | Toggle read/unread |
| `⌘R` | Refresh current feed |
| `⌘⇧R` | Refresh all feeds |
| `⌘F` | Open search |
| `⌘N` | Add new feed |
| `Escape` | Close sheet / search |

## Building from Source

Requires [Node.js](https://nodejs.org) (arm64) and npm.

```bash
git clone https://github.com/litaoran/rss-reader.git
cd rss-reader
npm install
npm start                          # dev mode
npm run make -- --arch arm64       # build distributable ZIP
```

The built ZIP lands in `out/make/zip/darwin/arm64/`.

> `npm install` triggers `electron-rebuild` to compile `better-sqlite3` for the correct Electron ABI. Make sure you're running arm64 Node (`node -e "console.log(process.arch)"` should print `arm64`).

## Tech Stack

- [Electron](https://www.electronjs.org) + [React](https://react.dev) + TypeScript
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) with FTS5 full-text search
- [rss-parser](https://github.com/rbren/rss-parser) for feed fetching
- [@mozilla/readability](https://github.com/mozilla/readability) for reader mode
- [electron-forge](https://www.electronforge.io) for packaging

## License

MIT
