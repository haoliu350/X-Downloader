const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const database = require('./src/database');

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Open the DevTools in development mode
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    await database.initialize();
    console.log('Database initialized successfully');
    
    // Set up IPC handlers for database operations
    setupIpcHandlers();
    
    createWindow();

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
});

function setupIpcHandlers() {
  // Get all profiles
  ipcMain.handle('get-profiles', async () => {
    try {
      return await database.getProfiles();
    } catch (error) {
      console.error('Error getting profiles:', error);
      throw error;
    }
  });

  // Add a profile
  ipcMain.handle('add-profile', async (_, username, profileUrl, displayName) => {
    try {
      return await database.addProfile(username, profileUrl, displayName);
    } catch (error) {
      console.error('Error adding profile:', error);
      throw error;
    }
  });

  // Delete a profile
  ipcMain.handle('delete-profile', async (_, id) => {
    try {
      return await database.deleteProfile(id);
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  });
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Close database connection when app is about to quit
app.on('will-quit', () => {
  database.close();
});