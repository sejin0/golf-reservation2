const express = require('express');
const router  = express.Router();
const db      = require('../db'); // 아까 만든 pg Pool 설정 파일
const dayjs   = require('dayjs');

// GET /api/teetimes
router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜를 입력하세요' });

  try {
    // 1. 설정 가져오기 (PostgreSQL은 await로 처리 가능)
    const settingsRes = await db.query('SELECT max_per_slot, min_per_team FROM settings WHERE id=1');
    if (settingsRes.rows.length === 0) return res.status(500).json({ error: 'settings 레코드 없음' });

    const s = settingsRes.rows[0];
    const maxPerSlot = s.max_per_slot ?? 4;
    const minPerTeam = s.min_per_team ?? 2;

    // 2. 해당 날짜의 슬롯 가져오기
    const slotsRes = await db.query(
      'SELECT * FROM tee_slots WHERE slot_date = $1 ORDER BY slot_time',
      [date]
    );
    const slots = slotsRes.rows;
    if (slots.length === 0) return res.json([]);

    const slotIds = slots.map(s => s.id);

    // 3. 주예약(reservations) 합계 조회
    // PostgreSQL 문법: IN ($1, $2, ...) 사용
    const mainRes = await db.query(`
      SELECT slot_id, 
             SUM(people_count)::int AS main_count, 
             COUNT(*)::int AS main_team_count
      FROM reservations
      WHERE slot_id = ANY($1) AND status = 'confirmed'
      GROUP BY slot_id
    `, [slotIds]); // ANY($1) 방식이 배열 처리에 효율적입니다.

    // 4. 조인예약(join_reservations) 합계 조회
    // PostgreSQL은 테이블 존재 여부 체크를 skip하고 try-catch로 잡거나 상시 생성 상태여야 함
    let joinRows = [];
    try {
      const joinRes = await db.query(`
        SELECT slot_id, 
               SUM(people_count)::int AS join_count, 
               COUNT(*)::int AS join_team_count
        FROM join_reservations
        WHERE slot_id = ANY($1) AND status = 'confirmed'
        GROUP BY slot_id
      `, [slotIds]);
      joinRows = joinRes.rows;
    } catch (e) {
      console.warn('⚠️ join_reservations 테이블이 아직 없거나 조회 실패');
    }

    // 5. 데이터 가공 (기존 로직 유지)
    const mainMap = {};
    mainRes.rows.forEach(r => { mainMap[r.slot_id] = r; });
    const joinMap = {};
    joinRows.forEach(r => { joinMap[r.slot_id] = r; });

    const result = slots.map(slot => {
      const m = mainMap[slot.id] || { main_count: 0, main_team_count: 0 };
      const j = joinMap[slot.id] || { join_count: 0, join_team_count: 0 };

      const mainCount     = m.main_count || 0;
      const joinCount     = j.join_count || 0;
      const joinTeamCount = j.join_team_count || 0;
      const mainTeamCount = m.main_team_count || 0;
      const reserved      = mainCount + joinCount;
      const remain        = maxPerSlot - reserved;

      const canTeam = slot.status === 'open' && remain >= minPerTeam;
      const canJoin = slot.status === 'open' && mainTeamCount >= 1 && remain >= 1 && joinTeamCount < 2;

      return {
        ...slot,
        max_per_slot: maxPerSlot,
        reserved_count: reserved,
        main_count: mainCount,
        join_count: joinCount,
        join_team_count: joinTeamCount,
        remain,
        can_team: canTeam ? 1 : 0,
        can_join: canJoin ? 1 : 0,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teetimes/generate
router.post('/generate', async (req, res) => {
  const { from, to } = req.body;
  try {
    const settingsRes = await db.query(`
      SELECT id, max_per_slot, min_per_team, 
            to_char(start_time, 'HH24:MI') as start_time, 
            to_char(end_time, 'HH24:MI') as end_time, 
            interval_min 
      FROM settings WHERE id=1
    `);
    const settings = settingsRes.rows[0];
    const { start_time, end_time, interval_min } = settings;

    let cur = dayjs(from);
    const last = dayjs(to);
    const values = [];

    while (cur.isBefore(last.add(1, 'day'))) {
      const dateStr = cur.format('YYYY-MM-DD');
      let t = dayjs(`${dateStr} ${start_time}`);
      const endT = dayjs(`${dateStr} ${end_time}`);
      while (t.isBefore(endT) || t.isSame(endT)) {
        values.push([dateStr, t.format('HH:mm')]);
        t = t.add(interval_min, 'minute');
      }
      cur = cur.add(1, 'day');
    }

    // PostgreSQL 대량 삽입 (INSERT ON CONFLICT 사용 - SQLite의 IGNORE 대응)
    let createdCount = 0;
    for (const row of values) {
      const ins = await db.query(`
        INSERT INTO tee_slots (slot_date, slot_time) 
        VALUES ($1, $2) 
        ON CONFLICT (slot_date, slot_time) DO NOTHING
      `, row);
      if (ins.rowCount > 0) createdCount++;
    }

    res.json({ success: true, created: createdCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/teetimes/:id
router.patch('/:id', async (req, res) => {
  const { status, memo } = req.body;
  const { id } = req.params;

  try {
    if (status !== undefined) {
      await db.query('UPDATE tee_slots SET status=$1 WHERE id=$2', [status, id]);
    } else if (memo !== undefined) {
      await db.query('UPDATE tee_slots SET memo=$1 WHERE id=$2', [memo, id]);
    } else {
      return res.status(400).json({ error: 'status 또는 memo 필요' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;