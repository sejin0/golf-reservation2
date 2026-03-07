const express = require('express');
const router = express.Router();
const db = require('../database');

// 설정 조회
router.get('/', (req, res) => {
  db.get('SELECT * FROM settings WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// 설정 저장 (관리자)
router.put('/', (req, res) => {
  const { start_time, end_time, interval_min, green_fee_9, green_fee_18, max_per_slot } = req.body;
  db.run(`
    UPDATE settings SET
      start_time   = ?,
      end_time     = ?,
      interval_min = ?,
      green_fee_9  = ?,
      green_fee_18 = ?,
      max_per_slot = ?,
      updated_at   = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [start_time, end_time, interval_min, green_fee_9, green_fee_18, max_per_slot],
  (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;