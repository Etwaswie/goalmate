const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'goals.db');

// Ensure parent folder exists before opening the database.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goal_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  goal TEXT NOT NULL,
  subgoals_json TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

function createUser(email, passwordHash) {
  const id = randomUUID();
  const stmt = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
  stmt.run(id, email, passwordHash);
  return { id, email };
}

function findUserByEmail(email) {
  return db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
  return db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE id = ?').get(id);
}

function insertGoalSession(userId, goal, subgoalsJson, metaJson) {
  const id = randomUUID();
  const stmt = db.prepare(
    'INSERT INTO goal_sessions (id, user_id, goal, subgoals_json, meta_json) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, userId || null, goal, subgoalsJson, metaJson);
  return id;
}

function getGoalHistoryForUser(userId, limit = 50) {
  const rows = db
    .prepare(
      'SELECT id, goal, subgoals_json, meta_json, created_at FROM goal_sessions WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT ?'
    )
    .all(userId, limit);

  return rows.map((row) => {
    let subgoals = [];
    let meta = null;
    try {
      subgoals = JSON.parse(row.subgoals_json);
    } catch (_) {}
    try {
      meta = JSON.parse(row.meta_json);
    } catch (_) {}
    return {
      id: row.id,
      goal: row.goal,
      subgoals,
      meta,
      created_at: row.created_at
    };
  });
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  insertGoalSession,
  getGoalHistoryForUser
};
