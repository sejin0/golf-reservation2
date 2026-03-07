const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

// 날짜별 티타임 슬롯 조회
// GET /api/teetimes?date=2025-06-01
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜를 입력하세요' });

  db.all(`
    SELECT
      ts.id, ts.slot_date, ts.slot_time, ts.status,
      s.max_per_slot,
      COALESCE(SUM(CASE WHEN r.status='confirmed' THEN r.people_count ELSE 0 END), 0) AS reserved_count
    FROM tee_slots ts
    JOIN settings s ON s.id = 1
    LEFT JOIN reservations r ON r.slot_id = ts.id
    WHERE ts.slot_date = ?
    GROUP BY ts.id
    ORDER BY ts.slot_time
  `, [date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 날짜 범위 슬롯 자동 생성
// POST /api/teetimes/generate  { from, to }
router.post('/generate', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from, to 날짜 필요' });

  db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
    if (err) return res.status(500).json({ error: err.message });

    const { start_time, end_time, interval_min } = settings;

    // 삽입할 데이터 미리 계산
    const rows = [];
    let cur = dayjs(from);
    const last = dayjs(to);

    while (cur.isBefore(last.add(1, 'day'))) {
      const dateStr = cur.format('YYYY-MM-DD');
      let t = dayjs(`${dateStr} ${start_time}`);
      const endT = dayjs(`${dateStr} ${end_time}`);
      while (t.isBefore(endT) || t.isSame(endT)) {
        rows.push([dateStr, t.format('HH:mm')]);
        t = t.add(interval_min, 'minute');
      }
      cur = cur.add(1, 'day');
    }

    // 하나씩 순차 삽입
    let count = 0;
    const insertNext = (i) => {
      if (i >= rows.length) return res.json({ success: true, created: count });
      db.run('INSERT OR IGNORE INTO tee_slots (slot_date, slot_time) VALUES (?, ?)',
        rows[i], (err2) => {
          if (!err2) count++;
          insertNext(i + 1);
        });
    };
    insertNext(0);
  });
});

// 슬롯 상태 변경
// PATCH /api/teetimes/:id  { status }
router.patch('/:id', (req, res) => {
  const { status } = req.body;
  db.run('UPDATE tee_slots SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;