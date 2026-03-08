const express = require('express');
const router  = express.Router();
const db      = require('../database');

/* ─────────────────────────────────────────────────────
   join_reservations 테이블 존재 여부 확인 헬퍼
   (구 버전 DB 호환 — 테이블 없으면 빈 배열 반환)
───────────────────────────────────────────────────── */
function queryJoin(sql, params, cb) {
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='join_reservations'", (e, t) => {
    if (e || !t) return cb(null, []);
    db.all(sql, params, cb);
  });
}

/* ─────────────────────────────────────────────────────
   공통: 기간 내 통계 쿼리 헬퍼
   주예약 + 조인예약 인원/매출 합산
───────────────────────────────────────────────────── */
function periodStats(fromDate, toDate, callback) {
  // 주예약 통계
  db.all(`
    SELECT ts.slot_date AS date,
           COUNT(DISTINCT r.id)               AS main_team_count,
           COALESCE(SUM(r.people_count), 0)   AS main_people,
           COALESCE(SUM(ci.pay_amount + COALESCE(ci.extra_charge,0)), 0) AS main_revenue
    FROM reservations r
    JOIN tee_slots ts ON ts.id = r.slot_id
    LEFT JOIN checkins ci ON ci.reservation_id = r.id
    WHERE ts.slot_date BETWEEN ? AND ? AND r.status = 'confirmed'
    GROUP BY ts.slot_date
  `, [fromDate, toDate], (err, mainRows) => {
    if (err) return callback(err);

    // 조인예약 통계 (테이블 존재 확인 포함)
    queryJoin(`
      SELECT ts.slot_date AS date,
             COUNT(DISTINCT jr.id)              AS join_team_count,
             COALESCE(SUM(jr.people_count), 0)  AS join_people,
             COALESCE(SUM(ci.pay_amount + COALESCE(ci.extra_charge,0)), 0) AS join_revenue
      FROM join_reservations jr
      JOIN tee_slots ts ON ts.id = jr.slot_id
      LEFT JOIN checkins ci ON ci.join_reservation_id = jr.id
      WHERE ts.slot_date BETWEEN ? AND ? AND jr.status = 'confirmed'
      GROUP BY ts.slot_date
    `, [fromDate, toDate], (err2, joinRows) => {
      if (err2) return callback(err2);

      // 날짜별 머지
      const map = {};
      (mainRows || []).forEach(r => {
        map[r.date] = {
          date:            r.date,
          main_team_count: r.main_team_count,
          join_team_count: 0,
          total_people:    r.main_people,
          total_revenue:   r.main_revenue,
        };
      });
      (joinRows || []).forEach(r => {
        if (map[r.date]) {
          map[r.date].join_team_count += r.join_team_count;
          map[r.date].total_people    += r.join_people;
          map[r.date].total_revenue   += r.join_revenue;
        } else {
          map[r.date] = {
            date:            r.date,
            main_team_count: 0,
            join_team_count: r.join_team_count,
            total_people:    r.join_people,
            total_revenue:   r.join_revenue,
          };
        }
      });

      const result = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
      callback(null, result);
    });
  });
}

/* ═══════════════════════════════════════════════════
   GET /api/stats/daily?date=
═══════════════════════════════════════════════════ */
router.get('/daily', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date 필요' });

  periodStats(date, date, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const row = rows[0] || {
      date,
      main_team_count: 0,
      join_team_count: 0,
      total_people:    0,
      total_revenue:   0,
    };
    res.json({ ...row, reservation_count: row.main_team_count });
  });
});

/* ═══════════════════════════════════════════════════
   GET /api/stats/weekly?from=&to=
═══════════════════════════════════════════════════ */
router.get('/weekly', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from, to 필요' });

  periodStats(from, to, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* ═══════════════════════════════════════════════════
   GET /api/stats/monthly?month=YYYY-MM
═══════════════════════════════════════════════════ */
router.get('/monthly', (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month 필요' });

  const from = `${month}-01`;
  const to   = `${month}-31`;

  periodStats(from, to, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
