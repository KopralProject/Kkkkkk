// db.js - setup SQLite
const Database = require('sqlite3').verbose();
const db = new Database('./accounts.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, user TEXT, credential TEXT, expire DATE
  )`);
});
module.exports = db;
