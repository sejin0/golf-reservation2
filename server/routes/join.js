const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL 연결 설정

/* ─────────────────────────────────────────────────────
   헬퍼 함수 (reservations.js와 동일한 로직)
───────────────────────────────────────────────────── */
async function getSlotReservedCount(slotId) {
  const query = `
    SELECT (
      SELECT COALESCE(SUM(people_count), 0) 
      FROM reservations 
      WHERE slot_id = $1 AND status = 'confirmed'
    ) + (
      SELECT COALESCE(SUM(people_count), 0) 
      FROM join_reservations 
      WHERE slot_id = $1 AND status = 'confirmed'
    ) AS total_count
  `;
  const res = await db.query(query, [slotId]);
  return parseInt(res.rows[0].total_count || 0);
}

async function syncSlotStatus(slotId) {
  try {
    const settingsRes = await db.query('SELECT max_per_slot FROM settings WHERE id=1');
    if (settingsRes.rows.length === 0) return;
    const max = settingsRes.rows[0].max_per_slot;
    const currentTotal = await getSlotReservedCount(slotId);
    const newStatus = currentTotal >= max ? 'full' : 'open';
    await db.query(`UPDATE tee_slots SET status = $1 WHERE id = $2 AND status != 'closed'`, [newStatus, slotId]);
  } catch (err) { console.error(err); }
}

/* ═══════════════════════════════════════════════════
   POST /api/join — 조인 예약 생성
   body: { slot_id, customer_id, people_count(보통 1~2) }
═══════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
  const { slot_id, customer_id, people_count, memo } = req.body;
  const pc = Number(people_count) || 1;

  try {
    // 1. 슬롯 상태 확인
    const slotRes = await db.query('SELECT * FROM tee_slots WHERE id = $1', [slot_id]);
    const slot = slotRes.rows[0];
    if (!slot) return res.status(404).json({ error: '티타임 없음' });
    if (slot.status === 'closed') return res.status(400).json({ error: '마감된 타임입니다' });

    // 2. 최대 인원 및 현재 예약 확인
    const settingsRes = await db.query('SELECT max_per_slot FROM settings WHERE id=1');
    const max = settingsRes.rows[0].max_per_slot;
    const currentTotal = await getSlotReservedCount(slot_id);

    if (currentTotal + pc > max) {
      return res.status(400).json({ error: '잔여석이 부족합니다.' });
    }

    // 3. 조인 예약 등록 (RETURNING 사용)
    const insertRes = await db.query(`
      INSERT INTO join_reservations (slot_id, customer_id, people_count, memo, status)
      VALUES ($1, $2, $3, $4, 'confirmed')
      RETURNING id
    `, [slot_id, customer_id, pc, memo || '']);

    const newId = insertRes.rows[0].id;
    await syncSlotStatus(slot_id);

    // 4. 결과 상세 반환
    const detailRes = await db.query(`
      SELECT jr.*, ts.slot_date, ts.slot_time, c.name, c.phone
      FROM join_reservations jr
      JOIN tee_slots ts ON ts.id = jr.slot_id
      JOIN customers c  ON c.id = jr.customer_id
      WHERE jr.id = $1
    `, [newId]);

    res.status(201).json(detailRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════
   PATCH /api/join/:id/cancel — 조인 예약 취소
═══════════════════════════════════════════════════ */
router.patch('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    const jrRes = await db.query('SELECT * FROM join_reservations WHERE id = $1', [id]);
    const jr = jrRes.rows[0];
    if (!jr) return res.status(404).json({ error: '조인 예약 없음' });

    await db.query(`UPDATE join_reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id]);
    await syncSlotStatus(jr.slot_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;