/**
 * 그린피 차등 설정 라우터
 *
 * 우선순위: 기간 규칙 > 요일 규칙 > 기본 설정(settings)
 *
 * 테이블 구조
 * ─────────────────────────────────────────────────────
 * green_fee_rules
 *   id          INTEGER PK
 *   rule_type   TEXT  'period' | 'weekday'
 *   label       TEXT  규칙 이름 (예: "여름 성수기", "주말")
 *   -- 기간 규칙 전용
 *   date_from   TEXT  YYYY-MM-DD
 *   date_to     TEXT  YYYY-MM-DD
 *   -- 요일 규칙 전용 (0=일,1=월,...,6=토, 복수 콤마구분 "0,6")
 *   weekdays    TEXT
 *   -- 공통 금액
 *   fee_9       INTEGER
 *   fee_18      INTEGER
 *   is_active   INTEGER DEFAULT 1
 *   priority    INTEGER DEFAULT 0  (높을수록 우선)
 *   created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
 */

const express = require('express');
const router  = express.Router();
const db      = require('../database');

/* ───────────────────────────── 초기화 ───────────────────────────── */
// 테이블이 없으면 생성 (서버 시작 시 database.js serialize 에서 이미 만들어도 되지만
// 여기서 보장용으로도 실행)
db.run(`CREATE TABLE IF NOT EXISTS green_fee_rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type  TEXT    NOT NULL CHECK(rule_type IN ('period','weekday')),
  label      TEXT    NOT NULL,
  date_from  TEXT,
  date_to    TEXT,
  weekdays   TEXT,
  fee_9      INTEGER NOT NULL DEFAULT 30000,
  fee_18     INTEGER NOT NULL DEFAULT 55000,
  is_active  INTEGER NOT NULL DEFAULT 1,
  priority   INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

/* ─────────────────── 목록 조회 GET /api/greenfee ─────────────────── */
router.get('/', (req, res) => {
  db.all(
    `SELECT * FROM green_fee_rules ORDER BY priority DESC, id ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

/* ────────────── 특정 날짜 적용 요금 조회 GET /api/greenfee/resolve?date= ────────────── */
router.get('/resolve', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date 파라미터 필요' });

  // 1) 기간 규칙 (우선순위 높은 것 먼저)
  db.get(
    `SELECT * FROM green_fee_rules
     WHERE rule_type='period' AND is_active=1
       AND date_from <= ? AND date_to >= ?
     ORDER BY priority DESC, id DESC
     LIMIT 1`,
    [date, date],
    (err, periodRule) => {
      if (err) return res.status(500).json({ error: err.message });
      if (periodRule) return res.json({ source: 'period', rule: periodRule, fee_9: periodRule.fee_9, fee_18: periodRule.fee_18 });

      // 2) 요일 규칙
      const dow = new Date(date).getDay(); // 0=일 ... 6=토
      db.all(
        `SELECT * FROM green_fee_rules
         WHERE rule_type='weekday' AND is_active=1
         ORDER BY priority DESC, id DESC`,
        (err2, weekdayRules) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const matched = weekdayRules.find(r =>
            r.weekdays && r.weekdays.split(',').map(Number).includes(dow)
          );
          if (matched) return res.json({ source: 'weekday', rule: matched, fee_9: matched.fee_9, fee_18: matched.fee_18 });

          // 3) 기본 설정 fallback
          db.get('SELECT green_fee_9, green_fee_18 FROM settings WHERE id=1', (err3, s) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ source: 'default', rule: null, fee_9: s?.green_fee_9 ?? 30000, fee_18: s?.green_fee_18 ?? 55000 });
          });
        }
      );
    }
  );
});

/* ───────────────── 규칙 생성 POST /api/greenfee ───────────────── */
router.post('/', (req, res) => {
  const { rule_type, label, date_from, date_to, weekdays, fee_9, fee_18, priority } = req.body;

  if (!rule_type || !label || fee_9 == null || fee_18 == null)
    return res.status(400).json({ error: '필수 항목 누락 (rule_type, label, fee_9, fee_18)' });

  if (rule_type === 'period' && (!date_from || !date_to))
    return res.status(400).json({ error: '기간 규칙은 date_from, date_to 필요' });

  if (rule_type === 'weekday' && !weekdays)
    return res.status(400).json({ error: '요일 규칙은 weekdays 필요' });

  db.run(
    `INSERT INTO green_fee_rules (rule_type, label, date_from, date_to, weekdays, fee_9, fee_18, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [rule_type, label, date_from || null, date_to || null, weekdays || null, fee_9, fee_18, priority ?? 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM green_fee_rules WHERE id=?', [this.lastID], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(row);
      });
    }
  );
});

/* ───────────────── 규칙 수정 PUT /api/greenfee/:id ───────────────── */
router.put('/:id', (req, res) => {
  const { rule_type, label, date_from, date_to, weekdays, fee_9, fee_18, is_active, priority } = req.body;
  db.run(
    `UPDATE green_fee_rules
     SET rule_type=?, label=?, date_from=?, date_to=?, weekdays=?,
         fee_9=?, fee_18=?, is_active=?, priority=?
     WHERE id=?`,
    [rule_type, label, date_from || null, date_to || null, weekdays || null,
     fee_9, fee_18, is_active ?? 1, priority ?? 0, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM green_fee_rules WHERE id=?', [req.params.id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(row);
      });
    }
  );
});

/* ───────────────── 규칙 삭제 DELETE /api/greenfee/:id ───────────────── */
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM green_fee_rules WHERE id=?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

/* ──────── 활성/비활성 토글 PATCH /api/greenfee/:id/toggle ──────── */
router.patch('/:id/toggle', (req, res) => {
  db.run(
    'UPDATE green_fee_rules SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM green_fee_rules WHERE id=?', [req.params.id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(row);
      });
    }
  );
});

module.exports = router;
