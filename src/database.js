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
          added_date TEXT DEFAULT CURRENT_TIMESTAMP
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
}

// Create a singleton instance
const database = new Database();

module.exports = database;