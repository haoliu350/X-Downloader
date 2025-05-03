const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();

class CookieExtractor {
  constructor() {
    this.twitterDomains = ['.twitter.com', 'twitter.com', 'x.com', '.x.com'];
  }

  /**
   * Get available browsers on the system
   * @returns {Array} List of available browsers
   */
  getAvailableBrowsers() {
    const browsers = [];
    
    // Check for Chrome
    if (this.getChromeProfilesPath()) {
      browsers.push({ id: 'chrome', name: 'Google Chrome' });
    }
    
    // Check for Firefox
    if (this.getFirefoxProfilesPath()) {
      browsers.push({ id: 'firefox', name: 'Mozilla Firefox' });
    }
    
    return browsers;
  }

  /**
   * Get Chrome profiles path based on OS
   * @returns {string|null} Path to Chrome profiles or null if not found
   */
  getChromeProfilesPath() {
    const platform = process.platform;
    const homeDir = app.getPath('home');
    
    let chromePath;
    if (platform === 'darwin') {
      // macOS
      chromePath = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
    } else if (platform === 'win32') {
      // Windows
      chromePath = path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    } else if (platform === 'linux') {
      // Linux
      chromePath = path.join(homeDir, '.config', 'google-chrome');
    }
    
    return fs.existsSync(chromePath) ? chromePath : null;
  }

  /**
   * Get Firefox profiles path based on OS
   * @returns {string|null} Path to Firefox profiles or null if not found
   */
  getFirefoxProfilesPath() {
    const platform = process.platform;
    const homeDir = app.getPath('home');
    
    let firefoxPath;
    if (platform === 'darwin') {
      // macOS
      firefoxPath = path.join(homeDir, 'Library', 'Application Support', 'Firefox', 'Profiles');
    } else if (platform === 'win32') {
      // Windows
      firefoxPath = path.join(homeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
    } else if (platform === 'linux') {
      // Linux
      firefoxPath = path.join(homeDir, '.mozilla', 'firefox');
    }
    
    return fs.existsSync(firefoxPath) ? firefoxPath : null;
  }

  /**
   * Get Chrome profiles
   * @returns {Array} List of Chrome profiles
   */
  getChromeProfiles() {
    const chromePath = this.getChromeProfilesPath();
    if (!chromePath) return [];
    
    const profiles = [];
    
    try {
      // Default profile
      if (fs.existsSync(path.join(chromePath, 'Default'))) {
        profiles.push({ id: 'Default', name: 'Default Profile' });
      }
      
      // Other profiles
      const files = fs.readdirSync(chromePath);
      for (const file of files) {
        if (file.startsWith('Profile ') && fs.statSync(path.join(chromePath, file)).isDirectory()) {
          profiles.push({ id: file, name: `Profile ${file.replace('Profile ', '')}` });
        }
      }
    } catch (error) {
      console.error('Error reading Chrome profiles:', error);
    }
    
    return profiles;
  }

  /**
   * Get Firefox profiles
   * @returns {Array} List of Firefox profiles
   */
  getFirefoxProfiles() {
    const firefoxPath = this.getFirefoxProfilesPath();
    if (!firefoxPath) return [];
    
    const profiles = [];
    
    try {
      const files = fs.readdirSync(firefoxPath);
      for (const file of files) {
        if (file.endsWith('.default') || file.includes('.default-release')) {
          profiles.push({ id: file, name: 'Default Profile' });
        } else if (fs.statSync(path.join(firefoxPath, file)).isDirectory()) {
          profiles.push({ id: file, name: `Profile: ${file}` });
        }
      }
    } catch (error) {
      console.error('Error reading Firefox profiles:', error);
    }
    
    return profiles;
  }

  /**
   * Extract cookies from Chrome
   * @param {string} profileId Chrome profile ID
   * @returns {Promise<Array>} Twitter cookies
   */
  async extractChromeTwitterCookies(profileId) {
    const chromePath = this.getChromeProfilesPath();
    if (!chromePath) return [];
    
    const cookiesDbPath = path.join(chromePath, profileId, 'Cookies');
    
    // Chrome cookies are stored in an SQLite database
    return new Promise((resolve, reject) => {
      // Create a temporary copy of the database to avoid locking issues
      const tempDbPath = path.join(app.getPath('temp'), `chrome_cookies_${Date.now()}.db`);
      
      try {
        fs.copyFileSync(cookiesDbPath, tempDbPath);
        
        const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          const cookies = [];
          const query = `
            SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly
            FROM cookies
            WHERE host_key LIKE '%twitter.com' OR host_key LIKE '%x.com'
          `;
          
          db.each(query, (err, row) => {
            if (err) {
              console.error('Error reading cookie:', err);
              return;
            }
            
            cookies.push({
              domain: row.host_key,
              name: row.name,
              value: row.value,
              path: row.path,
              expires: row.expires_utc,
              secure: Boolean(row.is_secure),
              httpOnly: Boolean(row.is_httponly)
            });
          }, (err) => {
            db.close();
            
            // Clean up the temporary file
            try {
              fs.unlinkSync(tempDbPath);
            } catch (e) {
              console.error('Error deleting temporary file:', e);
            }
            
            if (err) {
              reject(err);
            } else {
              resolve(cookies);
            }
          });
        });
      } catch (error) {
        console.error('Error copying cookies database:', error);
        reject(error);
      }
    });
  }

  /**
   * Extract cookies from Firefox
   * @param {string} profileId Firefox profile ID
   * @returns {Promise<Array>} Twitter cookies
   */
  async extractFirefoxTwitterCookies(profileId) {
    const firefoxPath = this.getFirefoxProfilesPath();
    if (!firefoxPath) return [];
    
    const cookiesDbPath = path.join(firefoxPath, profileId, 'cookies.sqlite');
    
    // Firefox cookies are stored in an SQLite database
    return new Promise((resolve, reject) => {
      // Create a temporary copy of the database to avoid locking issues
      const tempDbPath = path.join(app.getPath('temp'), `firefox_cookies_${Date.now()}.db`);
      
      try {
        fs.copyFileSync(cookiesDbPath, tempDbPath);
        
        const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          const cookies = [];
          const query = `
            SELECT host, name, value, path, expiry, isSecure, isHttpOnly
            FROM moz_cookies
            WHERE host LIKE '%twitter.com' OR host LIKE '%x.com'
          `;
          
          db.each(query, (err, row) => {
            if (err) {
              console.error('Error reading cookie:', err);
              return;
            }
            
            cookies.push({
              domain: row.host,
              name: row.name,
              value: row.value,
              path: row.path,
              expires: row.expiry,
              secure: Boolean(row.isSecure),
              httpOnly: Boolean(row.isHttpOnly)
            });
          }, (err) => {
            db.close();
            
            // Clean up the temporary file
            try {
              fs.unlinkSync(tempDbPath);
            } catch (e) {
              console.error('Error deleting temporary file:', e);
            }
            
            if (err) {
              reject(err);
            } else {
              resolve(cookies);
            }
          });
        });
      } catch (error) {
        console.error('Error copying cookies database:', error);
        reject(error);
      }
    });
  }

  /**
   * Format cookies for storage and use with HTTP requests
   * @param {Array} cookies Raw cookies
   * @returns {Object} Formatted cookies
   */
  formatCookiesForStorage(cookies) {
    // Format as a cookie string for HTTP requests
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    // Format as an object for storage
    const cookieObject = {
      cookieString,
      cookies,
      timestamp: new Date().toISOString()
    };
    
    return cookieObject;
  }
}

module.exports = new CookieExtractor();