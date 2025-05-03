const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class Database {
  constructor() {
    // Get user data path for storing the database
    const userDataPath = app ? app.getPath('userData') : './';
    this.dbPath = path.join(userDataPath, 'twitter_downloader.db');
    this.db = null;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Database opening error: ', err);
          reject(err);
          return;
        }
        
        console.log('Connected to the SQLite database at', this.dbPath);
        this.createTables()
          .then(resolve)
          .catch(reject);
      });
    });
  }

  createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Table for Twitter profiles
        this.db.run(`CREATE TABLE IF NOT EXISTS profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          profile_url TEXT NOT NULL,
          display_name TEXT,
          last_download_date TEXT,
          download_path TEXT,
          added_date TEXT DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });
        
        // Table for download history
        this.db.run(`CREATE TABLE IF NOT EXISTS downloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER,
          media_url TEXT NOT NULL,
          file_path TEXT NOT NULL,
          download_date TEXT DEFAULT CURRENT_TIMESTAMP,
          media_type TEXT,
          FOREIGN KEY (profile_id) REFERENCES profiles (id)
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Table for cookies
        this.db.run(`CREATE TABLE IF NOT EXISTS cookies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cookie_data TEXT NOT NULL,
          source TEXT NOT NULL,
          profile_name TEXT,
          added_date TEXT DEFAULT CURRENT_TIMESTAMP,
          is_active INTEGER DEFAULT 1
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  // Get all profiles
  getProfiles() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM profiles ORDER BY added_date DESC`, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Add a new profile
  addProfile(username, profileUrl, displayName = '') {
    
    console.log('Adding profile:', username, profileUrl, displayName); // Log the profile data to the console
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO profiles (username, profile_url, display_name) VALUES (?, ?, ?)`,
        [username, profileUrl, displayName],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }

  // Delete a profile
  deleteProfile(id) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM profiles WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  // Save cookies to database
  saveCookies(cookieData, source, profileName) {
    return new Promise((resolve, reject) => {
      // First, deactivate all existing cookies
      this.db.run(`UPDATE cookies SET is_active = 0`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Check if cookie values need decryption
        if (cookieData && cookieData.cookies) {
          console.log('Cookie data before processing:', 
            cookieData.cookies.map(c => ({name: c.name, valueLength: c.value ? c.value.length : 0}))
          );
          
          // Filter out cookies with empty values
          const validCookies = cookieData.cookies.filter(cookie => cookie.value && cookie.value.trim() !== '');
          
          if (validCookies.length === 0) {
            console.warn('Warning: All cookie values are empty. Browser encryption may be in use.');
          }
          
          // Update the cookieData with filtered cookies
          cookieData.cookies = validCookies;
        }
        
        console.log('Saving cookies:', cookieData); // Log the cookie data to the console
        
        // Then insert the new cookies
        this.db.run(
          `INSERT INTO cookies (cookie_data, source, profile_name, is_active) VALUES (?, ?, ?, 1)`,
          [JSON.stringify(cookieData), source, profileName],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.lastID);
          }
        );
      });
    });
  }

  // Get active cookies
  getActiveCookies() {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM cookies WHERE is_active = 1 ORDER BY added_date DESC LIMIT 1`, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row) {
          try {
            const cookieData = JSON.parse(row.cookie_data);
            resolve({
              ...row,
              cookie_data: cookieData
            });
          } catch (e) {
            reject(new Error('Invalid cookie data format'));
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  // Get all cookies
  getAllCookies() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM cookies ORDER BY added_date DESC`, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const cookies = rows.map(row => {
          try {
            return {
              ...row,
              cookie_data: JSON.parse(row.cookie_data)
            };
          } catch (e) {
            return {
              ...row,
              cookie_data: { error: 'Invalid cookie data format' }
            };
          }
        });
        
        resolve(cookies);
      });
    });
  }

  // Set a cookie as active
  setActiveCookie(id) {
    return new Promise((resolve, reject) => {
      this.db.run(`UPDATE cookies SET is_active = 0`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.db.run(`UPDATE cookies SET is_active = 1 WHERE id = ?`, [id], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        });
      });
    });
  }

  // Delete a cookie
  deleteCookie(id) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM cookies WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  // Close the database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }

  // Get stored cookies
  getCookies() {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM cookies ORDER BY added_date DESC LIMIT 1`, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  // Save cookies
  saveCookies(cookieData) {
    console.log('Saving cookies:', cookieData); // Log the cookie data to the console
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO cookies (cookie_data) VALUES (?)`,
        [JSON.stringify(cookieData)],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }

  // Delete cookies
  deleteCookies() {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM cookies`, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }
}

// Create a singleton instance
const database = new Database();

module.exports = database;