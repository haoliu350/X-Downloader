const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class BrowserCookieExtractor {
  constructor() {
    this.twitterDomains = ['.twitter.com', 'twitter.com', 'x.com', '.x.com'];
  }

  // Get Chrome cookies on macOS
  async getChromeCookies() {
    const homeDir = app.getPath('home');
    const cookiePath = path.join(homeDir, 'Library/Application Support/Google/Chrome/Default/Cookies');
    
    // Check if the cookie file exists
    if (!fs.existsSync(cookiePath)) {
      throw new Error('Chrome cookies database not found');
    }
    
    return this.extractCookiesFromChrome(cookiePath);
  }
  
  // Get Firefox cookies on macOS
  async getFirefoxCookies() {
    const homeDir = app.getPath('home');
    
    // Check multiple possible Firefox profile locations
    const possibleProfilePaths = [
      path.join(homeDir, 'Library/Application Support/Firefox/Profiles'),
      path.join(homeDir, 'Library/Mozilla/Firefox/Profiles'),
      path.join(homeDir, '.mozilla/firefox')
    ];
    
    let profilesPath = null;
    for (const testPath of possibleProfilePaths) {
      if (fs.existsSync(testPath)) {
        profilesPath = testPath;
        break;
      }
    }
    
    if (!profilesPath) {
      throw new Error('Firefox profiles directory not found. Please check if Firefox is installed.');
    }
    
    // Find all profiles (not just default-release)
    const profiles = fs.readdirSync(profilesPath);
    
    // Look for any valid profile with cookies.sqlite
    let cookiePath = null;
    let profileFound = null;
    
    for (const profile of profiles) {
      // Skip hidden files/directories
      if (profile.startsWith('.')) continue;
      
      const testCookiePath = path.join(profilesPath, profile, 'cookies.sqlite');
      if (fs.existsSync(testCookiePath)) {
        cookiePath = testCookiePath;
        profileFound = profile;
        break;
      }
    }
    
    if (!cookiePath) {
      throw new Error('Firefox cookies database not found. Please make sure Firefox has been used to visit Twitter.');
    }
    
    console.log(`Found Firefox profile: ${profileFound} at ${cookiePath}`);
    return this.extractCookiesFromFirefox(cookiePath);
  }
  
  // Extract cookies from Chrome
  extractCookiesFromChrome(cookiePath) {
    return new Promise((resolve, reject) => {
      // Create a temporary copy of the database to avoid locking issues
      const tempPath = path.join(app.getPath('temp'), 'chrome_cookies_temp.db');
      fs.copyFileSync(cookiePath, tempPath);
      
      const db = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // More precise SQL query to avoid matching domains like fedex.com
        const query = `
          SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly
          FROM cookies
          WHERE host_key = 'twitter.com' 
             OR host_key = '.twitter.com' 
             OR host_key LIKE '%.twitter.com' 
             OR host_key = 'x.com' 
             OR host_key = '.x.com' 
             OR host_key LIKE '%.x.com'
        `;
        
        db.all(query, [], (err, rows) => {
          db.close();
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(tempPath);
          } catch (e) {
            console.error('Error deleting temporary file:', e);
          }
          
          if (err) {
            reject(err);
            return;
          }
          
          // Format cookies for Twitter API
          const cookies = rows.map(row => ({
            domain: row.host_key,
            name: row.name,
            value: row.value,
            path: row.path,
            expires: row.expires_utc,
            secure: Boolean(row.is_secure),
            httpOnly: Boolean(row.is_httponly)
          }));
          
          resolve(cookies);
        });
      });
    });
  }
  
  // Extract cookies from Firefox
  extractCookiesFromFirefox(cookiePath) {
    return new Promise((resolve, reject) => {
      // Create a temporary copy of the database to avoid locking issues
      const tempPath = path.join(app.getPath('temp'), 'firefox_cookies_temp.db');
      fs.copyFileSync(cookiePath, tempPath);
      
      const db = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // More precise SQL query to avoid matching domains like fedex.com
        const query = `
          SELECT host, name, value, path, expiry, isSecure, isHttpOnly
          FROM moz_cookies
          WHERE host = 'twitter.com' 
             OR host = '.twitter.com' 
             OR host LIKE '%.twitter.com' 
             OR host = 'x.com' 
             OR host = '.x.com' 
             OR host LIKE '%.x.com'
        `;
        
        db.all(query, [], (err, rows) => {
          db.close();
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(tempPath);
          } catch (e) {
            console.error('Error deleting temporary file:', e);
          }
          
          if (err) {
            reject(err);
            return;
          }
          
          // Format cookies for Twitter API
          const cookies = rows.map(row => ({
            domain: row.host,
            name: row.name,
            value: row.value,
            path: row.path,
            expires: row.expiry,
            secure: Boolean(row.isSecure),
            httpOnly: Boolean(row.isHttpOnly)
          }));
          
          resolve(cookies);
        });
      });
    });
  }
  
  // Check if the extracted cookies contain the essential Twitter auth cookies
  validateTwitterCookies(cookies) {
    const requiredCookies = ['auth_token', 'ct0'];
    const cookieNames = cookies.map(cookie => cookie.name);
    
    const missingCookies = requiredCookies.filter(name => !cookieNames.includes(name));
    
    if (missingCookies.length > 0) {
      throw new Error(`Missing required Twitter cookies: ${missingCookies.join(', ')}`);
    }
    
    return true;
  }
}

module.exports = new BrowserCookieExtractor();