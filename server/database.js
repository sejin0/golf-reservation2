const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const db = new sqlite3.Database(path.join(dbDir, 'golf.db'), (err) => {
  if (err) console.error('DB 연결 실패:', err);
  else console.log('✅ SQLite DB 연결 성공');
});

db.serialize(() => {

  db.run(`PRAGMA foreign_keys = ON`);

  /* ──────────────────────────────────────────────
     1. 고객
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    phone      TEXT    NOT NULL UNIQUE,
    memo       TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  /* ──────────────────────────────────────────────
     2. 기본 설정 (싱글톤 id=1)
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    start_time   TEXT    DEFAULT '07:00',
    end_time     TEXT    DEFAULT '18:00',
    interval_min INTEGER DEFAULT 7,   -- 7 | 8 | 9 분
    green_fee_9  INTEGER DEFAULT 30000,
    green_fee_18 INTEGER DEFAULT 55000,
    max_per_slot INTEGER DEFAULT 4,   -- 슬롯당 최대 인원 (고정 4)
    min_per_team INTEGER DEFAULT 2,   -- 팀 최소 인원 (고정 2)
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);

  /* ──────────────────────────────────────────────
     3. 티타임 슬롯
     - course  : 출구분 (A/B/C 등, 추후 확장용)
     - status  : open | closed | full
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS tee_slots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_date  TEXT    NOT NULL,
    slot_time  TEXT    NOT NULL,
    course     TEXT    DEFAULT 'A',
    status     TEXT    DEFAULT 'open'
                       CHECK(status IN ('open','closed','full')),
    memo       TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_date, slot_time, course)
  )`);

  /* ──────────────────────────────────────────────
     4. 주예약 (팀예약)
     - people_count : 2 이상만 허용 (서버 로직에서 강제)
     - status : confirmed | cancelled
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id      INTEGER NOT NULL REFERENCES tee_slots(id),
    customer_id  INTEGER NOT NULL REFERENCES customers(id),
    people_count INTEGER NOT NULL DEFAULT 2
                         CHECK(people_count >= 2),
    holes        INTEGER NOT NULL DEFAULT 9
                         CHECK(holes IN (9, 18)),
    status       TEXT    NOT NULL DEFAULT 'confirmed'
                         CHECK(status IN ('confirmed','cancelled')),
    memo         TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  /* ──────────────────────────────────────────────
     5. 조인예약 (주예약에 종속)
     - reservation_id : 주예약 FK
     - people_count   : 1~2명 (서버 로직에서 강제)
     - 동일 slot에 최대 2팀까지 조인 가능
       (2-1-1 / 2-2 / 2-1 케이스 모두 커버)
     - status : confirmed | cancelled
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS join_reservations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id),
    slot_id        INTEGER NOT NULL REFERENCES tee_slots(id),
    customer_id    INTEGER NOT NULL REFERENCES customers(id),
    people_count   INTEGER NOT NULL DEFAULT 1
                           CHECK(people_count >= 1),
    holes          INTEGER NOT NULL DEFAULT 9
                           CHECK(holes IN (9, 18)),
    status         TEXT    NOT NULL DEFAULT 'confirmed'
                           CHECK(status IN ('confirmed','cancelled')),
    memo           TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  /* ──────────────────────────────────────────────
     6. 체크인 / 현장 결제
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER REFERENCES reservations(id),
    join_reservation_id INTEGER REFERENCES join_reservations(id),
    pay_method     TEXT    CHECK(pay_method IN ('cash','card','transfer')),
    pay_amount     INTEGER DEFAULT 0,
    extra_charge   INTEGER DEFAULT 0,
    extra_memo     TEXT,
    checked_in_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- 주예약 또는 조인예약 중 하나만 참조
    CHECK(
      (reservation_id IS NOT NULL AND join_reservation_id IS NULL) OR
      (reservation_id IS NULL     AND join_reservation_id IS NOT NULL)
    )
  )`);

  /* ──────────────────────────────────────────────
     7. 그린피 차등 규칙
     - rule_type : period(기간) | weekday(요일)
     - 우선순위  : 기간 > 요일 > 기본설정
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS green_fee_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type  TEXT    NOT NULL CHECK(rule_type IN ('period','weekday')),
    label      TEXT    NOT NULL,
    date_from  TEXT,
    date_to    TEXT,
    weekdays   TEXT,   -- 콤마구분 "0,6" (0=일,6=토)
    fee_9      INTEGER NOT NULL DEFAULT 30000,
    fee_18     INTEGER NOT NULL DEFAULT 55000,
    is_active  INTEGER NOT NULL DEFAULT 1,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  /* ──────────────────────────────────────────────
     8. 위약자 관리 (추후 기능)
  ────────────────────────────────────────────── */
  db.run(`CREATE TABLE IF NOT EXISTS penalty_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER NOT NULL REFERENCES customers(id),
    reservation_id INTEGER REFERENCES reservations(id),
    reason         TEXT,
    penalty_fee    INTEGER DEFAULT 0,
    is_paid        INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('✅ DB 초기화 완료');

  /* ──────────────────────────────────────────────
     마이그레이션: 기존 DB에 누락 컬럼·테이블 추가
     (DB를 삭제하지 않고 서버를 재시작해도 안전하게 동작)
  ────────────────────────────────────────────── */
  function addColumnIfMissing(table, column, definition) {
    db.all(`PRAGMA table_info(${table})`, (err, cols) => {
      if (err || !cols) return;
      const exists = cols.some(c => c.name === column);
      if (!exists) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (e) => {
          if (e) console.error(`  ✗ ALTER ${table}.${column}:`, e.message);
          else   console.log(`  ✅ 마이그레이션: ${table}.${column} 추가`);
        });
      }
    });
  }

  // settings 테이블 — min_per_team 컬럼
  addColumnIfMissing('settings', 'min_per_team', 'INTEGER DEFAULT 2');

  // tee_slots 테이블 — course, memo 컬럼
  addColumnIfMissing('tee_slots', 'course', "TEXT DEFAULT 'A'");
  addColumnIfMissing('tee_slots', 'memo',   'TEXT');

  // reservations 테이블 — memo, updated_at 컬럼
  addColumnIfMissing('reservations', 'memo',       'TEXT');
  addColumnIfMissing('reservations', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  // join_reservations 테이블이 없으면 생성 (구 버전 DB 대비)
  db.run(`CREATE TABLE IF NOT EXISTS join_reservations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id),
    slot_id        INTEGER NOT NULL REFERENCES tee_slots(id),
    customer_id    INTEGER NOT NULL REFERENCES customers(id),
    people_count   INTEGER NOT NULL DEFAULT 1,
    holes          INTEGER NOT NULL DEFAULT 9,
    status         TEXT    NOT NULL DEFAULT 'confirmed',
    memo           TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (e) => {
    if (e) console.error('join_reservations 생성 오류:', e.message);
    else   console.log('✅ join_reservations 테이블 준비 완료');
  });

  // checkins 테이블 — join_reservation_id 컬럼 (구 버전 대비)
  addColumnIfMissing('checkins', 'join_reservation_id', 'INTEGER REFERENCES join_reservations(id)');

  // green_fee_rules 테이블이 없으면 생성
  db.run(`CREATE TABLE IF NOT EXISTS green_fee_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type  TEXT    NOT NULL DEFAULT 'period',
    label      TEXT    NOT NULL DEFAULT '',
    date_from  TEXT,
    date_to    TEXT,
    weekdays   TEXT,
    fee_9      INTEGER NOT NULL DEFAULT 30000,
    fee_18     INTEGER NOT NULL DEFAULT 55000,
    is_active  INTEGER NOT NULL DEFAULT 1,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (e) => {
    if (e) console.error('green_fee_rules 생성 오류:', e.message);
    else   console.log('✅ green_fee_rules 테이블 준비 완료');
  });

  // penalty_records 테이블이 없으면 생성
  db.run(`CREATE TABLE IF NOT EXISTS penalty_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER NOT NULL REFERENCES customers(id),
    reservation_id INTEGER REFERENCES reservations(id),
    reason         TEXT,
    penalty_fee    INTEGER DEFAULT 0,
    is_paid        INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (e) => {
    if (!e) console.log('✅ penalty_records 테이블 준비 완료');
  });

  console.log('✅ DB 마이그레이션 완료');
});

module.exports = db;
