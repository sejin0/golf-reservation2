const express = require('express');
const router  = express.Router();
const db      = require('../database');
const dayjs   = require('dayjs');

/* ═══════════════════════════════════════════════════
   GET /api/teetimes?date=YYYY-MM-DD
   반환 필드:
     - 기본 슬롯 정보
     - reserved_count  : 주예약 + 조인예약 합산 인원
     - main_count      : 주예약 인원
     - join_count      : 조인예약 인원
     - remain          : 잔여 인원
     - can_team        : 팀예약 가능 여부 (잔여 2명 이상)
     - can_join        : 조인 가능 여부
     - join_team_count : 현재 조인 팀 수
═══════════════════════════════════════════════════ */
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜를 입력하세요' });

  db.get('SELECT max_per_slot, min_per_team FROM settings WHERE id=1', (err, s) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!s)  return res.status(500).json({ error: 'settings 레코드 없음 — 서버를 재시작하세요' });

    const maxPerSlot = s.max_per_slot ?? 4;
    const minPerTeam = s.min_per_team ?? 2;

    db.all(`
      SELECT ts.*
      FROM tee_slots ts
      WHERE ts.slot_date = ?
      ORDER BY ts.slot_time
    `, [date], (err2, slots) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!slots || slots.length === 0) return res.json([]);

      const slotIds = slots.map(s => s.id);
      const placeholders = slotIds.map(() => '?').join(',');

      // 슬롯별 주예약 인원 합계
      db.all(`
        SELECT slot_id,
               SUM(people_count) AS main_count,
               COUNT(*)          AS main_team_count
        FROM reservations
        WHERE slot_id IN (${placeholders})
          AND status = 'confirmed'
        GROUP BY slot_id
      `, slotIds, (err3, mainRows) => {
        if (err3) return res.status(500).json({ error: 'reservations 조회 실패: ' + err3.message });

        // join_reservations 테이블 존재 여부 먼저 확인
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='join_reservations'", (errChk, tableRow) => {
          if (errChk) return res.status(500).json({ error: errChk.message });

          const buildResult = (joinRows = []) => {
            const mainMap = {};
            (mainRows || []).forEach(r => { mainMap[r.slot_id] = r; });
            const joinMap = {};
            joinRows.forEach(r => { joinMap[r.slot_id] = r; });

            const result = slots.map(slot => {
              const m = mainMap[slot.id] || { main_count: 0, main_team_count: 0 };
              const j = joinMap[slot.id] || { join_count: 0, join_team_count: 0 };

              const mainCount     = m.main_count      || 0;
              const joinCount     = j.join_count       || 0;
              const joinTeamCount = j.join_team_count  || 0;
              const mainTeamCount = m.main_team_count  || 0;
              const reserved      = mainCount + joinCount;
              const remain        = maxPerSlot - reserved;

              const canTeam = slot.status === 'open' && remain >= minPerTeam;
              const canJoin = slot.status === 'open'
                           && mainTeamCount >= 1
                           && remain >= 1
                           && joinTeamCount < 2;

              return {
                ...slot,
                max_per_slot:    maxPerSlot,
                reserved_count:  reserved,
                main_count:      mainCount,
                join_count:      joinCount,
                join_team_count: joinTeamCount,
                remain,
                can_team: canTeam ? 1 : 0,
                can_join: canJoin ? 1 : 0,
              };
            });

            res.json(result);
          };

          // join_reservations 테이블이 없으면 빈 배열로 처리
          if (!tableRow) {
            console.warn('⚠️  join_reservations 테이블 없음 — 서버를 재시작하면 자동 생성됩니다');
            return buildResult([]);
          }

          db.all(`
            SELECT slot_id,
                   SUM(people_count) AS join_count,
                   COUNT(*)          AS join_team_count
            FROM join_reservations
            WHERE slot_id IN (${placeholders})
              AND status = 'confirmed'
            GROUP BY slot_id
          `, slotIds, (err4, joinRows) => {
            if (err4) return res.status(500).json({ error: 'join_reservations 조회 실패: ' + err4.message });
            buildResult(joinRows || []);
          });
        });
      });
    });
  });
});

/* ═══════════════════════════════════════════════════
   POST /api/teetimes/generate  { from, to }
═══════════════════════════════════════════════════ */
router.post('/generate', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from, to 날짜 필요' });

  db.get('SELECT * FROM settings WHERE id=1', (err, settings) => {
    if (err)      return res.status(500).json({ error: err.message });
    if (!settings) return res.status(500).json({ error: 'settings 없음 — 서버를 재시작하세요' });

    const { start_time, end_time, interval_min } = settings;

    const rows = [];
    let cur      = dayjs(from);
    const last   = dayjs(to);

    while (cur.isBefore(last.add(1, 'day'))) {
      const dateStr = cur.format('YYYY-MM-DD');
      let t         = dayjs(`${dateStr} ${start_time}`);
      const endT    = dayjs(`${dateStr} ${end_time}`);
      while (t.isBefore(endT) || t.isSame(endT)) {
        rows.push([dateStr, t.format('HH:mm')]);
        t = t.add(interval_min, 'minute');
      }
      cur = cur.add(1, 'day');
    }

    if (rows.length === 0)
      return res.status(400).json({ error: '생성할 슬롯이 없습니다. 날짜·설정을 확인하세요' });

    let count = 0;
    const insertNext = (i) => {
      if (i >= rows.length) return res.json({ success: true, created: count });
      db.run(
        'INSERT OR IGNORE INTO tee_slots (slot_date, slot_time) VALUES (?, ?)',
        rows[i],
        function(err2) {
          // changes > 0 이면 실제 삽입됨 (IGNORE 로 건너뛴 경우 0)
          if (!err2 && this.changes > 0) count++;
          insertNext(i + 1);
        }
      );
    };
    insertNext(0);
  });
});

/* ═══════════════════════════════════════════════════
   PATCH /api/teetimes/:id  { status?, memo? }
═══════════════════════════════════════════════════ */
router.patch('/:id', (req, res) => {
  const { status, memo } = req.body;

  if (status !== undefined) {
    if (!['open', 'closed'].includes(status))
      return res.status(400).json({ error: 'status 는 open 또는 closed 만 가능' });
    db.run('UPDATE tee_slots SET status=? WHERE id=?', [status, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
    return;
  }

  if (memo !== undefined) {
    db.run('UPDATE tee_slots SET memo=? WHERE id=?', [memo, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
    return;
  }

  res.status(400).json({ error: 'status 또는 memo 필요' });
});

module.exports = router;
