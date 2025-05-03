const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Database operations
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  addProfile: (username, profileUrl, displayName) => 
    ipcRenderer.invoke('add-profile', username, profileUrl, displayName),
  deleteProfile: (id) => ipcRenderer.invoke('delete-profile', id),
  
  // Cookie operations
  getBrowserCookies: (browserType) => ipcRenderer.invoke('get-browser-cookies', browserType),
  getStoredCookies: () => ipcRenderer.invoke('get-stored-cookies'),
  saveCookiesManually: (cookieData) => ipcRenderer.invoke('save-cookies-manually', cookieData),
  deleteCookies: () => ipcRenderer.invoke('delete-cookies'),
  
  // Version information
  getVersions: () => {
    return {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron
    };
  }
});