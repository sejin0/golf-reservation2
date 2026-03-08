const express = require('express');
const router  = express.Router();
const db      = require('../database');

/* ─────────────────────────────────────────────────────
   join_reservations 테이블 존재 여부 확인 헬퍼
───────────────────────────────────────────────────── */
function queryJoin(sql, params, cb) {
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='join_reservations'", (e, t) => {
    if (e || !t) return cb(null, []);
    db.all(sql, params, cb);
  });
}

/* ═══════════════════════════════════════════════════
   POST /api/checkin  — 체크인 + 결제 등록
   body:
     주예약:  { reservation_id, pay_method, pay_amount, extra_charge, extra_memo }
     조인예약: { join_reservation_id, pay_method, pay_amount, extra_charge, extra_memo }
═══════════════════════════════════════════════════ */
router.post('/', (req, res) => {
  const { reservation_id, join_reservation_id,
          pay_method, pay_amount, extra_charge, extra_memo } = req.body;

  if (!reservation_id && !join_reservation_id)
    return res.status(400).json({ error: 'reservation_id 또는 join_reservation_id 필요' });
  if (reservation_id && join_reservation_id)
    return res.status(400).json({ error: 'reservation_id 와 join_reservation_id 둘 다 입력 불가' });

  const checkSql   = reservation_id
    ? 'SELECT id FROM checkins WHERE reservation_id=?'
    : 'SELECT id FROM checkins WHERE join_reservation_id=?';
  const checkParam = reservation_id || join_reservation_id;

  db.get(checkSql, [checkParam], (err, exist) => {
    if (err)   return res.status(500).json({ error: err.message });
    if (exist) return res.status(400).json({ error: '이미 체크인된 예약입니다' });

    const rsvSql = reservation_id
      ? 'SELECT id FROM reservations WHERE id=? AND status="confirmed"'
      : 'SELECT id FROM join_reservations WHERE id=? AND status="confirmed"';

    db.get(rsvSql, [checkParam], (err2, rsv) => {
      if (err2)  return res.status(500).json({ error: err2.message });
      if (!rsv)  return res.status(404).json({ error: '예약 없음 또는 취소된 예약' });

      db.run(`
        INSERT INTO checkins
          (reservation_id, join_reservation_id, pay_method, pay_amount, extra_charge, extra_memo)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        reservation_id      || null,
        join_reservation_id || null,
        pay_method || 'cash',
        pay_amount || 0,
        extra_charge || 0,
        extra_memo || '',
      ], function(err3) {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ success: true, checkin_id: this.lastID });
      });
    });
  });
});

/* ═══════════════════════════════════════════════════
   GET /api/checkin?date=  — 날짜별 체크인 목록
   주예약 + 조인예약 체크인 모두 반환
═══════════════════════════════════════════════════ */
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜 필요' });

  // 주예약 체크인
  db.all(`
    SELECT ci.*,
           'main' AS booking_type,
           r.people_count, r.holes, r.id AS reservation_id,
           ts.slot_date, ts.slot_time,
           COALESCE(ts.course, 'A') AS course,
           c.name, c.phone
    FROM checkins ci
    JOIN reservations r ON r.id = ci.reservation_id
    JOIN tee_slots ts   ON ts.id = r.slot_id
    JOIN customers c    ON c.id  = r.customer_id
    WHERE ts.slot_date = ? AND ci.reservation_id IS NOT NULL
    ORDER BY ts.slot_time
  `, [date], (err, mainRows) => {
    if (err) return res.status(500).json({ error: err.message });

    // 조인예약 체크인 (테이블 존재 확인 포함)
    queryJoin(`
      SELECT ci.*,
             'join' AS booking_type,
             jr.people_count, jr.holes, jr.id AS join_reservation_id,
             jr.reservation_id AS main_reservation_id,
             ts.slot_date, ts.slot_time,
             COALESCE(ts.course, 'A') AS course,
             c.name, c.phone
      FROM checkins ci
      JOIN join_reservations jr ON jr.id = ci.join_reservation_id
      JOIN tee_slots ts         ON ts.id = jr.slot_id
      JOIN customers c          ON c.id  = jr.customer_id
      WHERE ts.slot_date = ? AND ci.join_reservation_id IS NOT NULL
      ORDER BY ts.slot_time
    `, [date], (err2, joinRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ main: mainRows || [], join: joinRows || [] });
    });
  });
});

module.exports = router;
