const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Database operations
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  addProfile: (username, profileUrl, displayName) => 
    ipcRenderer.invoke('add-profile', username, profileUrl, displayName),
  deleteProfile: (id) => ipcRenderer.invoke('delete-profile', id),
  
  // Version information
  getVersions: () => {
    return {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron
    };
  }
});