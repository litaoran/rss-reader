import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rss', {
  feeds: {
    list: () => ipcRenderer.invoke('feeds:list'),
    discover: (url: string) => ipcRenderer.invoke('feeds:discover', url),
    add: (url: string, name: string, folder: string | null) =>
      ipcRenderer.invoke('feeds:add', url, name, folder),
    remove: (id: number) => ipcRenderer.invoke('feeds:remove', id),
    updateFolder: (id: number, folder: string | null) =>
      ipcRenderer.invoke('feeds:updateFolder', id, folder),
    markAllRead: (id: number) => ipcRenderer.invoke('feeds:markAllRead', id),
  },
  articles: {
    list: (feedId: number | null, options: object) =>
      ipcRenderer.invoke('articles:list', feedId, options),
    get: (id: number) => ipcRenderer.invoke('articles:get', id),
    fetchContent: (id: number) => ipcRenderer.invoke('articles:fetchContent', id),
    markRead: (id: number) => ipcRenderer.invoke('articles:markRead', id),
    toggleStar: (id: number) => ipcRenderer.invoke('articles:toggleStar', id),
    updateProgress: (id: number, progress: number) =>
      ipcRenderer.invoke('articles:updateProgress', id, progress),
    search: (query: string) => ipcRenderer.invoke('articles:search', query),
  },
  refresh: {
    all: () => ipcRenderer.invoke('refresh:all'),
    feed: (id: number) => ipcRenderer.invoke('refresh:feed', id),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  on: (channel: string, fn: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => fn(...args));
  },
  off: (channel: string, fn: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, fn);
  },
});
