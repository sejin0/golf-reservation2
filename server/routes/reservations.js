const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL 연결 설정

/* ─────────────────────────────────────────────────────
   1. 헬퍼 함수들 (내부 로직용)
───────────────────────────────────────────────────── */

// 슬롯의 현재 예약 인원 합계 계산
async function getSlotReservedCount(slotId) {
  const query = `
    SELECT (
      SELECT COALESCE(SUM(people_count), 0) FROM reservations 
      WHERE slot_id = $1 AND status = 'confirmed'
    ) + (
      SELECT COALESCE(SUM(people_count), 0) FROM join_reservations 
      WHERE slot_id = $1 AND status = 'confirmed'
    ) AS total_count
  `;
  const res = await db.query(query, [slotId]);
  return parseInt(res.rows[0].total_count || 0);
}

// 슬롯 상태 갱신 (full / open 자동 전환)
async function syncSlotStatus(slotId) {
  try {
    const settingsRes = await db.query('SELECT max_per_slot FROM settings WHERE id=1');
    if (settingsRes.rows.length === 0) return;

    const max = settingsRes.rows[0].max_per_slot;
    const currentTotal = await getSlotReservedCount(slotId);
    const newStatus = currentTotal >= max ? 'full' : 'open';
    
    await db.query(`
      UPDATE tee_slots SET status = $1 
      WHERE id = $2 AND status != 'closed'
    `, [newStatus, slotId]);
  } catch (err) {
    console.error('syncSlotStatus 에러:', err);
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/reservations — 주예약(팀예약) 생성
═══════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
  // 프론트에서 이름(name)과 전화번호(phone)를 반드시 보내줘야 합니다.
  const { slot_id, people_count, holes, memo, name, phone, reservation_type } = req.body;

  if (!slot_id || !phone || !name) {
    return res.status(400).json({ error: '필수 항목 누락 (slot_id, name, phone)' });
  }

  const normalizedPhone = String(phone).replace(/\D/g, '');
  if (normalizedPhone.length < 8) {
    return res.status(400).json({ error: '전화번호를 정확히 입력하세요' });
  }

  const pc = Number(people_count) || 4;
  if (pc < 2) return res.status(400).json({ error: '팀예약은 최소 2명부터 가능합니다' });

  try {
    // [STEP 1] 고객 정보 처리 (Upsert: 없으면 인서트, 있으면 이름 업데이트)
    // 이 쿼리를 쓰려면 customers 테이블의 phone 컬럼에 UNIQUE 제약조건이 있어야 합니다.
    const custRes = await db.query(`
      INSERT INTO customers (name, phone)
      VALUES ($1, $2)
      ON CONFLICT (phone) 
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [name, normalizedPhone]);
    
    const customer_id = custRes.rows[0].id;

    // [STEP 2] 슬롯 및 인원 가용성 확인
    const slotRes = await db.query('SELECT * FROM tee_slots WHERE id = $1', [slot_id]);
    const slot = slotRes.rows[0];
    if (!slot) return res.status(404).json({ error: '티타임 없음' });
    if (slot.status === 'closed') return res.status(400).json({ error: '마감된 티타임입니다' });

    const settingsRes = await db.query('SELECT max_per_slot FROM settings WHERE id=1');
    const max = settingsRes.rows[0].max_per_slot;
    const currentTotal = await getSlotReservedCount(slot_id);

    if (currentTotal + pc > max) {
      return res.status(400).json({ error: `인원 초과. 현재 ${currentTotal}명 예약됨, 최대 ${max}명` });
    }

    // [STEP 3] 예약 실행
    const insertRes = await db.query(`
      INSERT INTO reservations (slot_id, customer_id, people_count, holes, memo, status)
      VALUES ($1, $2, $3, $4, $5, 'confirmed')
      RETURNING id
    `, [slot_id, customer_id, pc, holes || 18, memo || '']);

    const newId = insertRes.rows[0].id;

    if (reservation_type === 'team' || !reservation_type) {
      // 팀예약은 티타임 전체 구매로 즉시 만석 처리
      await db.query('UPDATE tee_slots SET status=$1 WHERE id=$2', ['full', slot_id]);
    } else {
      // 조인 주예약 또는 일반 주예약은 사람 합산으로 상태 결정
      await syncSlotStatus(slot_id);
    }

    // [STEP 4] 결과 상세 조회 반환 (이름, 전화번호 포함)
    const detailRes = await db.query(`
      SELECT r.*, ts.slot_date, ts.slot_time, c.name, c.phone
      FROM reservations r
      JOIN tee_slots ts ON ts.id = r.slot_id
      JOIN customers c  ON c.id  = r.customer_id
      WHERE r.id = $1
    `, [newId]);

    res.status(201).json(detailRes.rows[0]);
  } catch (err) {
    console.error('예약 생성 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════
   PATCH /api/reservations/:id/cancel — 주예약(팀예약) 취소
═══════════════════════════════════════════════════ */
router.patch('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    const resvRes = await db.query('SELECT * FROM reservations WHERE id = $1', [id]);
    const reservation = resvRes.rows[0];
    if (!reservation) return res.status(404).json({ error: '예약 없음' });

    await db.query(
      `UPDATE reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [id]
    );

    await db.query(
      `UPDATE join_reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP
       WHERE slot_id=$1 AND status='confirmed'`,
      [reservation.slot_id]
    );

    await syncSlotStatus(reservation.slot_id);
    res.json({ success: true });
  } catch (err) {
    console.error('예약 취소 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════
   GET /api/reservations (조회 로직 - main / join 구분)
═══════════════════════════════════════════════════════════ */
router.get('/', async (req, res) => {
  const { date, phone, name } = req.query;
  try {
    if (!date && !phone && !name) {
      return res.status(400).json({ error: 'date 또는 phone 또는 name 필요' });
    }

    let mainQuery = `
      SELECT r.*, ts.slot_date, ts.slot_time, COALESCE(ts.course, 'A') AS course,
             c.name, c.phone, 'main' AS booking_type
      FROM reservations r
      JOIN tee_slots ts ON ts.id = r.slot_id
      JOIN customers c  ON c.id  = r.customer_id
      WHERE r.status = 'confirmed'
    `;
    let mainParams = [];
    let conditions = [];
    let joinQuery = null;
    let joinParams = [];

    if (date) {
      mainParams.push(date);
      conditions.push(`ts.slot_date = $${mainParams.length}`);
    }

    if (phone) {
      const normalizedPhone = String(phone).replace(/\D/g, '');
      mainParams.push(normalizedPhone);
      conditions.push(`REPLACE(c.phone, '-', '') = $${mainParams.length}`);

      joinQuery = `
        SELECT jr.*, ts.slot_date, ts.slot_time, COALESCE(ts.course, 'A') AS course,
               c.name, c.phone, 'join' AS booking_type
        FROM join_reservations jr
        JOIN tee_slots ts ON ts.id = jr.slot_id
        JOIN customers c ON c.id = jr.customer_id
        WHERE jr.status = 'confirmed' AND REPLACE(c.phone, '-', '') = $1
        ORDER BY ts.slot_date DESC, ts.slot_time DESC
      `;
      joinParams = [normalizedPhone];
    }

    if (name) {
      const term = `%${name}%`;
      mainParams.push(term);
      conditions.push(`c.name ILIKE $${mainParams.length}`);

      joinQuery = `
        SELECT jr.*, ts.slot_date, ts.slot_time, COALESCE(ts.course, 'A') AS course,
               c.name, c.phone, 'join' AS booking_type
        FROM join_reservations jr
        JOIN tee_slots ts ON ts.id = jr.slot_id
        JOIN customers c ON c.id = jr.customer_id
        WHERE jr.status = 'confirmed' AND c.name ILIKE $1
        ORDER BY ts.slot_date DESC, ts.slot_time DESC
      `;
      joinParams = [term];
    }

    if (conditions.length > 0) {
      mainQuery += ' AND ' + conditions.join(' AND ');
    }

    mainQuery += phone ? ' ORDER BY ts.slot_date DESC, ts.slot_time DESC' : ' ORDER BY ts.slot_time, r.id';

    const mainResult = await db.query(mainQuery, mainParams);
    const joinResult = joinQuery ? await db.query(joinQuery, joinParams) : { rows: [] };

    res.json({ main: mainResult.rows, join: joinResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;