const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL 연결 설정

/* ═══════════════════════════════════════════════════
   POST /api/checkin — 체크인 + 결제 등록
═══════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
  const { 
    reservation_id, 
    join_reservation_id,
    pay_method, 
    pay_amount, 
    extra_charge, 
    extra_memo 
  } = req.body;

  // 1. 유효성 검사
  if (!reservation_id && !join_reservation_id)
    return res.status(400).json({ error: 'reservation_id 또는 join_reservation_id 필요' });
  if (reservation_id && join_reservation_id)
    return res.status(400).json({ error: '둘 다 동시에 입력할 수 없습니다.' });

  try {
    // 2. 이미 체크인했는지 확인
    const checkSql = reservation_id
      ? 'SELECT id FROM checkins WHERE reservation_id = $1'
      : 'SELECT id FROM checkins WHERE join_reservation_id = $1';
    const checkParam = reservation_id || join_reservation_id;

    const existRes = await db.query(checkSql, [checkParam]);
    if (existRes.rows.length > 0) {
      return res.status(400).json({ error: '이미 체크인된 예약입니다.' });
    }

    // 3. 예약이 유효한지(존재하며 확정 상태인지) 확인
    const rsvSql = reservation_id
      ? 'SELECT id FROM reservations WHERE id = $1 AND status = \'confirmed\''
      : 'SELECT id FROM join_reservations WHERE id = $1 AND status = \'confirmed\'';

    const rsvRes = await db.query(rsvSql, [checkParam]);
    if (rsvRes.rows.length === 0) {
      return res.status(404).json({ error: '예약 없음 또는 취소된 예약입니다.' });
    }

    // 4. 체크인 정보 삽입 (RETURNING 사용)
    const insertRes = await db.query(`
      INSERT INTO checkins
        (reservation_id, join_reservation_id, pay_method, pay_amount, extra_charge, extra_memo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      reservation_id || null,
      join_reservation_id || null,
      pay_method || 'cash',
      pay_amount || 0,
      extra_charge || 0,
      extra_memo || ''
    ]);

    res.json({ success: true, checkin_id: insertRes.rows[0].id });
  } catch (err) {
    console.error('체크인 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════
   GET /api/checkin?date= — 날짜별 체크인 목록
═══════════════════════════════════════════════════ */
router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜 파라미터가 필요합니다.' });

  try {
    // 1. 주예약 체크인 목록 조회
    const mainCheckins = await db.query(`
      SELECT ci.*, 'main' AS booking_type,
             r.people_count, r.holes, r.id AS reservation_id,
             ts.slot_date, ts.slot_time, COALESCE(ts.course, 'A') AS course,
             c.name, c.phone
      FROM checkins ci
      JOIN reservations r ON r.id = ci.reservation_id
      JOIN tee_slots ts   ON ts.id = r.slot_id
      JOIN customers c    ON c.id  = r.customer_id
      WHERE ts.slot_date = $1 AND ci.reservation_id IS NOT NULL
      ORDER BY ts.slot_time
    `, [date]);

    // 2. 조인예약 체크인 목록 조회
    const joinCheckins = await db.query(`
      SELECT ci.*, 'join' AS booking_type,
             jr.people_count, jr.holes, jr.id AS join_reservation_id,
             jr.reservation_id AS main_reservation_id,
             ts.slot_date, ts.slot_time, COALESCE(ts.course, 'A') AS course,
             c.name, c.phone
      FROM checkins ci
      JOIN join_reservations jr ON jr.id = ci.join_reservation_id
      JOIN tee_slots ts         ON ts.id = jr.slot_id
      JOIN customers c          ON c.id  = jr.customer_id
      WHERE ts.slot_date = $1 AND ci.join_reservation_id IS NOT NULL
      ORDER BY ts.slot_time
    `, [date]);

    res.json({ 
      main: mainCheckins.rows, 
      join: joinCheckins.rows 
    });
  } catch (err) {
    console.error('체크인 목록 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;