const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const database = require('./src/database');
const browserCookies = require('./src/browserCookies');
const cookieExtractor = require('./src/cookie-extractor');

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
  // Profile operations
  ipcMain.handle('get-profiles', async () => {
    try {
      return await database.getProfiles();
    } catch (error) {
      console.error('Error getting profiles:', error);
      throw error;
    }
  });

  ipcMain.handle('add-profile', async (_, username, profileUrl, displayName) => {
    try {
      return await database.addProfile(username, profileUrl, displayName);
    } catch (error) {
      console.error('Error adding profile:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-profile', async (_, id) => {
    try {
      return await database.deleteProfile(id);
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  });

  // Browser cookie operations
  ipcMain.handle('get-available-browsers', () => {
    return cookieExtractor.getAvailableBrowsers();
  });

  ipcMain.handle('get-browser-profiles', (_, browserId) => {
    if (browserId === 'chrome') {
      return cookieExtractor.getChromeProfiles();
    } else if (browserId === 'firefox') {
      return cookieExtractor.getFirefoxProfiles();
    }
    return [];
  });

  ipcMain.handle('extract-browser-cookies', async (_, browserId, profileId) => {
    try {
      let cookies = [];
      let source = '';
      let profileName = '';
      
      if (browserId === 'chrome') {
        cookies = await cookieExtractor.extractChromeTwitterCookies(profileId);
        source = 'Chrome';
        profileName = profileId === 'Default' ? 'Default Profile' : `Profile ${profileId.replace('Profile ', '')}`;
      } else if (browserId === 'firefox') {
        cookies = await cookieExtractor.extractFirefoxTwitterCookies(profileId);
        source = 'Firefox';
        profileName = profileId.includes('.default') ? 'Default Profile' : `Profile: ${profileId}`;
      }
      
      if (cookies.length === 0) {
        throw new Error('No Twitter cookies found in the selected browser profile. Make sure you are logged into Twitter in this browser profile.');
      }
      
      const formattedCookies = cookieExtractor.formatCookiesForStorage(cookies);
      
      // Save cookies to database
      await database.saveCookies(formattedCookies, source, profileName);
      
      return {
        success: true,
        message: `Successfully extracted ${cookies.length} Twitter cookies from ${source} (${profileName})`,
        count: cookies.length
      };
    } catch (error) {
      console.error('Error extracting cookies:', error);
      throw error;
    }
  });

  // Cookie management operations
  ipcMain.handle('get-active-cookies', async () => {
    try {
      return await database.getActiveCookies();
    } catch (error) {
      console.error('Error getting active cookies:', error);
      throw error;
    }
  });

  ipcMain.handle('get-all-cookies', async () => {
    try {
      return await database.getAllCookies();
    } catch (error) {
      console.error('Error getting all cookies:', error);
      throw error;
    }
  });

  ipcMain.handle('set-active-cookie', async (_, id) => {
    try {
      return await database.setActiveCookie(id);
    } catch (error) {
      console.error('Error setting active cookie:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-cookie', async (_, id) => {
    try {
      return await database.deleteCookie(id);
    } catch (error) {
      console.error('Error deleting cookie:', error);
      throw error;
    }
  });

  // Manual cookie input
  ipcMain.handle('save-manual-cookie', async (_, cookieString) => {
    try {
      // Parse the cookie string into individual cookies
      const cookies = cookieString.split(';').map(cookie => {
        const [name, value] = cookie.trim().split('=');
        return {
          name,
          value,
          domain: '.twitter.com',
          path: '/'
        };
      });
      
      const formattedCookies = cookieExtractor.formatCookiesForStorage(cookies);
      
      // Save cookies to database
      await database.saveCookies(formattedCookies, 'Manual Input', 'User Provided');
      
      return {
        success: true,
        message: 'Successfully saved manual cookie input',
        count: cookies.length
      };
    } catch (error) {
      console.error('Error saving manual cookie:', error);
      throw error;
    }
  });
  
  // Get browser cookies
  ipcMain.handle('get-browser-cookies', async (_, browserType) => {
    try {
      let cookies;
      
      if (browserType === 'chrome') {
        cookies = await browserCookies.getChromeCookies();
      } else if (browserType === 'firefox') {
        cookies = await browserCookies.getFirefoxCookies();
      } else {
        throw new Error('Unsupported browser type');
      }
      
      // Validate cookies
      browserCookies.validateTwitterCookies(cookies);
      
      // Save cookies to database
      await database.saveCookies(cookies);
      
      return { success: true, message: 'Cookies extracted and saved successfully' };
    } catch (error) {
      console.error('Error extracting cookies:', error);
      return { success: false, message: error.message };
    }
  });
  
  // Get stored cookies
  ipcMain.handle('get-stored-cookies', async () => {
    try {
      const cookies = await database.getCookies();
      return cookies;
    } catch (error) {
      console.error('Error getting stored cookies:', error);
      throw error;
    }
  });
  
  // Save cookies manually
  ipcMain.handle('save-cookies-manually', async (_, cookieData) => {
    try {
      // Parse and validate the cookie data
      const cookies = JSON.parse(cookieData);
      
      // Save cookies to database
      await database.saveCookies(cookies);
      
      return { success: true, message: 'Cookies saved successfully' };
    } catch (error) {
      console.error('Error saving cookies manually:', error);
      return { success: false, message: error.message };
    }
  });
  
  // Delete cookies
  ipcMain.handle('delete-cookies', async () => {
    try {
      await database.deleteCookies();
      return { success: true, message: 'Cookies deleted successfully' };
    } catch (error) {
      console.error('Error deleting cookies:', error);
      return { success: false, message: error.message };
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