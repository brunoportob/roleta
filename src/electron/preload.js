import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readItems: () => ipcRenderer.invoke('items:read'),
  writeItems: (items) => ipcRenderer.invoke('items:write', items)
});
