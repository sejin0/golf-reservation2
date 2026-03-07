const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// db 폴더 없으면 자동 생성
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const db = new sqlite3.Database(path.join(dbDir, 'golf.db'), (err) => {
  if (err) console.error('DB 연결 실패:', err);
  else console.log('✅ SQLite DB 연결 성공');
});

// 순서대로 테이블 생성
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL UNIQUE,
    memo       TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    start_time   TEXT DEFAULT '07:00',
    end_time     TEXT DEFAULT '18:00',
    interval_min INTEGER DEFAULT 7,
    green_fee_9  INTEGER DEFAULT 30000,
    green_fee_18 INTEGER DEFAULT 55000,
    max_per_slot INTEGER DEFAULT 4,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);

  db.run(`CREATE TABLE IF NOT EXISTS tee_slots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_date  TEXT NOT NULL,
    slot_time  TEXT NOT NULL,
    holes      INTEGER DEFAULT 9,
    status     TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_date, slot_time)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id      INTEGER NOT NULL REFERENCES tee_slots(id),
    customer_id  INTEGER NOT NULL REFERENCES customers(id),
    people_count INTEGER DEFAULT 1,
    holes        INTEGER DEFAULT 9,
    status       TEXT DEFAULT 'confirmed',
    memo         TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id),
    pay_method     TEXT,
    pay_amount     INTEGER,
    extra_charge   INTEGER DEFAULT 0,
    extra_memo     TEXT,
    checked_in_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;