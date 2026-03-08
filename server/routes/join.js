const express = require('express');
const router  = express.Router();
const db      = require('../database');

/* ─────────────────────────────────────────────────────
   슬롯 현재 예약 인원 합계 헬퍼
───────────────────────────────────────────────────── */
function getSlotReservedCount(slotId, callback) {
  db.get(`
    SELECT COALESCE(SUM(people_count), 0) AS main_total
    FROM reservations WHERE slot_id=? AND status='confirmed'
  `, [slotId], (err, r1) => {
    if (err) return callback(err, 0);
    const mainTotal = r1 ? r1.main_total : 0;

    db.get(`
      SELECT COALESCE(SUM(people_count), 0) AS join_total
      FROM join_reservations WHERE slot_id=? AND status='confirmed'
    `, [slotId], (err2, r2) => {
      if (err2) return callback(null, mainTotal);
      callback(null, mainTotal + (r2 ? r2.join_total : 0));
    });
  });
}

/* ─────────────────────────────────────────────────────
   슬롯 상태 갱신 헬퍼
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
   POST /api/join  — 조인예약 생성
   body: { reservation_id, customer_id, people_count(1~2), holes, memo }

   조인 가능 조건:
   1. 주예약(reservation_id)이 confirmed 상태
   2. 슬롯 잔여 인원이 people_count 이상
   3. 동일 슬롯에 조인 confirmed 팀이 2팀 미만
   4. people_count 는 1 이상 (잔여인원 이내)
═══════════════════════════════════════════════════ */
router.post('/', (req, res) => {
  const { reservation_id, customer_id, people_count, holes, memo } = req.body;

  if (!reservation_id || !customer_id)
    return res.status(400).json({ error: '필수 항목 누락 (reservation_id, customer_id)' });

  const pc = Number(people_count);
  if (!pc || pc < 1)
    return res.status(400).json({ error: '조인 인원은 최소 1명입니다' });
  if (pc > 2)
    return res.status(400).json({ error: '조인 1팀은 최대 2명까지 가능합니다' });

  // 주예약 조회
  db.get('SELECT * FROM reservations WHERE id=?', [reservation_id], (err, mainRsv) => {
    if (err)      return res.status(500).json({ error: err.message });
    if (!mainRsv) return res.status(404).json({ error: '주예약 없음' });
    if (mainRsv.status === 'cancelled')
      return res.status(400).json({ error: '취소된 주예약입니다' });

    const slotId = mainRsv.slot_id;

    // 슬롯 상태 확인
    db.get('SELECT * FROM tee_slots WHERE id=?', [slotId], (err2, slot) => {
      if (err2)   return res.status(500).json({ error: err2.message });
      if (!slot)  return res.status(404).json({ error: '티타임 없음' });
      if (slot.status === 'closed')
        return res.status(400).json({ error: '마감된 티타임입니다' });
      if (slot.status === 'full')
        return res.status(400).json({ error: '만석입니다' });

      db.get('SELECT max_per_slot FROM settings WHERE id=1', (err3, s) => {
        if (err3) return res.status(500).json({ error: err3.message });

        // 현재 슬롯 총 예약 인원
        getSlotReservedCount(slotId, (err4, currentTotal) => {
          if (err4) return res.status(500).json({ error: err4.message });

          const remain = s.max_per_slot - currentTotal;

          if (remain <= 0)
            return res.status(400).json({ error: '잔여 자리가 없습니다' });
          if (pc > remain)
            return res.status(400).json({
              error: `잔여 자리(${remain}명)를 초과합니다`
            });

          // 동일 슬롯의 조인 팀 수 확인 (최대 2팀)
          db.get(`
            SELECT COUNT(*) AS join_team_count
            FROM join_reservations
            WHERE slot_id=? AND status='confirmed'
          `, [slotId], (err5, jRow) => {
            if (err5) return res.status(500).json({ error: err5.message });

            if (jRow.join_team_count >= 2)
              return res.status(400).json({
                error: '조인은 최대 2팀까지 가능합니다'
              });

            // 조인예약 삽입
            db.run(`
              INSERT INTO join_reservations
                (reservation_id, slot_id, customer_id, people_count, holes, memo)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [reservation_id, slotId, customer_id, pc, holes || 9, memo || ''],
            function(err6) {
              if (err6) return res.status(500).json({ error: err6.message });

              const newId = this.lastID;
              syncSlotStatus(slotId);

              db.get(`
                SELECT jr.*, ts.slot_date, ts.slot_time, ts.course,
                       c.name, c.phone
                FROM join_reservations jr
                JOIN tee_slots ts ON ts.id = jr.slot_id
                JOIN customers c  ON c.id  = jr.customer_id
                WHERE jr.id = ?
              `, [newId], (err7, row) => {
                if (err7) return res.status(500).json({ error: err7.message });
                res.status(201).json(row);
              });
            });
          });
        });
      });
    });
  });
});

/* ═══════════════════════════════════════════════════
   GET /api/join?reservation_id=  — 주예약에 딸린 조인 목록
═══════════════════════════════════════════════════ */
router.get('/', (req, res) => {
  const { reservation_id, slot_id } = req.query;

  if (reservation_id) {
    db.all(`
      SELECT jr.*, c.name, c.phone
      FROM join_reservations jr
      JOIN customers c ON c.id = jr.customer_id
      WHERE jr.reservation_id = ? AND jr.status = 'confirmed'
      ORDER BY jr.id
    `, [reservation_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  if (slot_id) {
    db.all(`
      SELECT jr.*, c.name, c.phone
      FROM join_reservations jr
      JOIN customers c ON c.id = jr.customer_id
      WHERE jr.slot_id = ? AND jr.status = 'confirmed'
      ORDER BY jr.id
    `, [slot_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  res.status(400).json({ error: 'reservation_id 또는 slot_id 파라미터 필요' });
});

/* ═══════════════════════════════════════════════════
   PUT /api/join/:id  — 조인예약 수정
   body: { people_count(1~2), holes, memo }
═══════════════════════════════════════════════════ */
router.put('/:id', (req, res) => {
  const { people_count, holes, memo } = req.body;
  const pc = Number(people_count);

  if (!pc || pc < 1)
    return res.status(400).json({ error: '조인 인원은 최소 1명입니다' });
  if (pc > 2)
    return res.status(400).json({ error: '조인 1팀은 최대 2명까지 가능합니다' });

  db.get('SELECT * FROM join_reservations WHERE id=?', [req.params.id], (err, jr) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!jr)  return res.status(404).json({ error: '조인예약 없음' });
    if (jr.status === 'cancelled')
      return res.status(400).json({ error: '취소된 예약은 수정할 수 없습니다' });

    db.get('SELECT max_per_slot FROM settings WHERE id=1', (err2, s) => {
      if (err2) return res.status(500).json({ error: err2.message });

      getSlotReservedCount(jr.slot_id, (err3, currentTotal) => {
        if (err3) return res.status(500).json({ error: err3.message });

        const newTotal = (currentTotal - jr.people_count) + pc;
        if (newTotal > s.max_per_slot)
          return res.status(400).json({
            error: `인원 초과. 최대 ${s.max_per_slot}명 (현재 다른 예약 ${currentTotal - jr.people_count}명)`
          });

        db.run(`UPDATE join_reservations
                SET people_count=?, holes=?, memo=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?`,
          [pc, holes || jr.holes, memo !== undefined ? memo : jr.memo, req.params.id],
          (err4) => {
            if (err4) return res.status(500).json({ error: err4.message });
            syncSlotStatus(jr.slot_id);
            res.json({ success: true });
          }
        );
      });
    });
  });
});

/* ═══════════════════════════════════════════════════
   PATCH /api/join/:id/cancel  — 조인예약 취소
═══════════════════════════════════════════════════ */
router.patch('/:id/cancel', (req, res) => {
  db.get('SELECT * FROM join_reservations WHERE id=?', [req.params.id], (err, jr) => {
    if (err)  return res.status(500).json({ error: err.message });
    if (!jr)  return res.status(404).json({ error: '조인예약 없음' });
    if (jr.status === 'cancelled')
      return res.status(400).json({ error: '이미 취소된 조인예약입니다' });

    db.run(`UPDATE join_reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP
            WHERE id=?`, [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      syncSlotStatus(jr.slot_id);
      res.json({ success: true });
    });
  });
});

module.exports = router;
