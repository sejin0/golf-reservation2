const express = require('express');
const router  = express.Router();
const db      = require('../database');

/* ─────────────────────────────────────────────────────
   슬롯의 현재 예약 인원 합계를 계산하는 헬퍼
   주예약 + 조인예약 confirmed 인원 합산
───────────────────────────────────────────────────── */
function getSlotReservedCount(slotId, callback) {
  // 주예약 인원
  db.get(`
    SELECT COALESCE(SUM(people_count), 0) AS main_total
    FROM reservations WHERE slot_id=? AND status='confirmed'
  `, [slotId], (err, r1) => {
    if (err) return callback(err, 0);
    const mainTotal = r1 ? r1.main_total : 0;

    // join_reservations 테이블 존재 여부 확인
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='join_reservations'", (e, t) => {
      if (e || !t) return callback(null, mainTotal);

      db.get(`
        SELECT COALESCE(SUM(people_count), 0) AS join_total
        FROM join_reservations WHERE slot_id=? AND status='confirmed'
      `, [slotId], (err2, r2) => {
        if (err2) return callback(null, mainTotal); // 오류 시 주예약만 카운트
        callback(null, mainTotal + (r2 ? r2.join_total : 0));
      });
    });
  });
}

/* ─────────────────────────────────────────────────────
   슬롯 상태 갱신 헬퍼 (full / open 자동 전환)
───────────────────────────────────────────────────── */
function syncSlotStatus(slotId) {
  db.get('SELECT max_per_slot FROM settings WHERE id=1', (err, s) => {
    if (err || !s) return;
    getSlotReservedCount(slotId, (err2, total) => {
      if (err2) return;
      const newStatus = total >= s.max_per_slot ? 'full' : 'open';
      db.run(`UPDATE tee_slots SET status=?
              WHERE id=? AND status != 'closed'`,
             [newStatus, slotId]);
    });
  });
}

/* ═══════════════════════════════════════════════════
   POST /api/reservations  — 주예약(팀예약) 생성
   body: { slot_id, customer_id, people_count(≥2), holes, memo }
═══════════════════════════════════════════════════ */
router.post('/', (req, res) => {
  const { slot_id, customer_id, people_count, holes, memo } = req.body;

  if (!slot_id || !customer_id)
    return res.status(400).json({ error: '필수 항목 누락 (slot_id, customer_id)' });

  const pc = Number(people_count);
  if (!pc || pc < 2)
    return res.status(400).json({ error: '팀예약은 최소 2명부터 가능합니다' });

  db.get('SELECT * FROM tee_slots WHERE id=?', [slot_id], (err, slot) => {
    if (err)    return res.status(500).json({ error: err.message });
    if (!slot)  return res.status(404).json({ error: '티타임 없음' });
    if (slot.status === 'closed')
      return res.status(400).json({ error: '마감된 티타임입니다' });
    if (slot.status === 'full')
      return res.status(400).json({ error: '만석입니다' });

    db.get('SELECT max_per_slot FROM settings WHERE id=1', (err2, s) => {
      if (err2) return res.status(500).json({ error: err2.message });

      getSlotReservedCount(slot_id, (err3, currentTotal) => {
        if (err3) return res.status(500).json({ error: err3.message });

        if (currentTotal + pc > s.max_per_slot)
          return res.status(400).json({
            error: `인원 초과. 현재 ${currentTotal}명 예약됨, 최대 ${s.max_per_slot}명`
          });

        db.run(`
          INSERT INTO reservations (slot_id, customer_id, people_count, holes, memo)
          VALUES (?, ?, ?, ?, ?)
        `, [slot_id, customer_id, pc, holes || 9, memo || ''],
        function(err4) {
          if (err4) return res.status(500).json({ error: err4.message });

          const newId = this.lastID;
          syncSlotStatus(slot_id);

          db.get(`
            SELECT r.*, ts.slot_date, ts.slot_time, c.name, c.phone
            FROM reservations r
            JOIN tee_slots ts ON ts.id = r.slot_id
            JOIN customers c  ON c.id  = r.customer_id
            WHERE r.id = ?
          `, [newId], (err5, row) => {
            if (err5) return res.status(500).json({ error: err5.message });
            res.status(201).json(row);
          });
        });
      });
    });
  });
});

/* ═══════════════════════════════════════════════════
   GET /api/reservations?date=  |  ?phone=
═══════════════════════════════════════════════════ */
router.get('/', (req, res) => {
  const { date, phone } = req.query;

  // join_reservations 테이블 존재 여부 확인 (구 DB 호환)
  function queryJoin(sql, params, cb) {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='join_reservations'", (e, t) => {
      if (e || !t) return cb(null, []);   // 테이블 없으면 빈 배열
      db.all(sql, params, cb);
    });
  }

  if (date) {
    db.all(`
      SELECT r.*, ts.slot_date, ts.slot_time,
             COALESCE(ts.course, 'A') AS course,
             c.name, c.phone,
             'main' AS booking_type
      FROM reservations r
      JOIN tee_slots ts ON ts.id = r.slot_id
      JOIN customers c  ON c.id  = r.customer_id
      WHERE ts.slot_date = ? AND r.status = 'confirmed'
      ORDER BY ts.slot_time, r.id
    `, [date], (err, mainRows) => {
      if (err) return res.status(500).json({ error: err.message });

      queryJoin(`
        SELECT jr.*, ts.slot_date, ts.slot_time,
               COALESCE(ts.course, 'A') AS course,
               c.name, c.phone,
               'join' AS booking_type
        FROM join_reservations jr
        JOIN tee_slots ts ON ts.id = jr.slot_id
        JOIN customers c  ON c.id  = jr.customer_id
        WHERE ts.slot_date = ? AND jr.status = 'confirmed'
        ORDER BY ts.slot_time, jr.id
      `, [date], (err2, joinRows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ main: mainRows || [], join: joinRows || [] });
      });
    });
    return;
  }

  if (phone) {
    db.all(`
      SELECT r.*, ts.slot_date, ts.slot_time,
             COALESCE(ts.course, 'A') AS course,
             c.name, c.phone,
             'main' AS booking_type
      FROM reservations r
      JOIN tee_slots ts ON ts.id = r.slot_id
      JOIN customers c  ON c.id  = r.customer_id
      WHERE c.phone = ? AND r.status = 'confirmed'
      ORDER BY ts.slot_date DESC, ts.slot_time DESC
    `, [phone], (err, mainRows) => {
      if (err) return res.status(500).json({ error: err.message });

      queryJoin(`
        SELECT jr.*, ts.slot_date, ts.slot_time,
               COALESCE(ts.course, 'A') AS course,
               c.name, c.phone,
               'join' AS booking_type
        FROM join_reservations jr
        JOIN tee_slots ts ON ts.id = jr.slot_id
        JOIN customers c  ON c.id  = jr.customer_id
        WHERE c.phone = ? AND jr.status = 'confirmed'
        ORDER BY ts.slot_date DESC, ts.slot_time DESC
      `, [phone], (err2, joinRows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ main: mainRows || [], join: joinRows || [] });
      });
    });
    return;
  }

  res.status(400).json({ error: 'date 또는 phone 파라미터 필요' });
});

/* ═══════════════════════════════════════════════════
   PUT /api/reservations/:id  — 주예약 수정
   body: { people_count(≥2), holes, memo }
═══════════════════════════════════════════════════ */
router.put('/:id', (req, res) => {
  const { people_count, holes, memo } = req.body;
  const pc = Number(people_count);

  if (!pc || pc < 2)
    return res.status(400).json({ error: '팀예약은 최소 2명부터 가능합니다' });

  db.get('SELECT * FROM reservations WHERE id=?', [req.params.id], (err, rsv) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!rsv) return res.status(404).json({ error: '예약 없음' });
    if (rsv.status === 'cancelled')
      return res.status(400).json({ error: '취소된 예약은 수정할 수 없습니다' });

    db.get('SELECT max_per_slot FROM settings WHERE id=1', (err2, s) => {
      if (err2) return res.status(500).json({ error: err2.message });

      getSlotReservedCount(rsv.slot_id, (err3, currentTotal) => {
        if (err3) return res.status(500).json({ error: err3.message });

        // 현재 인원에서 이 예약 인원 빼고 새 인원으로 계산
        const newTotal = (currentTotal - rsv.people_count) + pc;
        if (newTotal > s.max_per_slot)
          return res.status(400).json({
            error: `인원 초과. 최대 ${s.max_per_slot}명 (현재 다른 예약 ${currentTotal - rsv.people_count}명)`
          });

        db.run(`UPDATE reservations
                SET people_count=?, holes=?, memo=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?`,
          [pc, holes || rsv.holes, memo !== undefined ? memo : rsv.memo, req.params.id],
          (err4) => {
            if (err4) return res.status(500).json({ error: err4.message });
            syncSlotStatus(rsv.slot_id);
            res.json({ success: true });
          }
        );
      });
    });
  });
});

/* ═══════════════════════════════════════════════════
   GET /api/reservations/:id  — 단건 조회 (주예약)
═══════════════════════════════════════════════════ */
router.get('/:id', (req, res) => {
  db.get(`
    SELECT r.*, ts.slot_date, ts.slot_time, ts.course,
           c.name, c.phone
    FROM reservations r
    JOIN tee_slots ts ON ts.id = r.slot_id
    JOIN customers c  ON c.id  = r.customer_id
    WHERE r.id = ?
  `, [req.params.id], (err, row) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '예약 없음' });

    // 조인 목록도 함께
    db.all(`
      SELECT jr.*, c.name, c.phone
      FROM join_reservations jr
      JOIN customers c ON c.id = jr.customer_id
      WHERE jr.reservation_id = ? AND jr.status = 'confirmed'
    `, [req.params.id], (err2, joins) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ...row, joins });
    });
  });
});

/* ═══════════════════════════════════════════════════
   PATCH /api/reservations/:id/cancel  — 주예약 취소
   → 해당 슬롯의 조인예약도 함께 취소
═══════════════════════════════════════════════════ */
router.patch('/:id/cancel', (req, res) => {
  db.get('SELECT * FROM reservations WHERE id=?', [req.params.id], (err, rsv) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!rsv) return res.status(404).json({ error: '예약 없음' });
    if (rsv.status === 'cancelled')
      return res.status(400).json({ error: '이미 취소된 예약입니다' });

    db.run(`UPDATE reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP
            WHERE id=?`, [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      // 주예약 취소 시 연결된 조인예약도 취소
      db.run(`UPDATE join_reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP
              WHERE reservation_id=? AND status='confirmed'`, [req.params.id]);

      syncSlotStatus(rsv.slot_id);
      res.json({ success: true });
    });
  });
});

module.exports = router;
