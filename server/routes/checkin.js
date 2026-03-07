const express = require('express');
const router = express.Router();
const db = require('../database');

// 체크인 + 현장 결제 입력
router.post('/', (req, res) => {
  const { reservation_id, pay_method, pay_amount, extra_charge, extra_memo } = req.body;
  if (!reservation_id) return res.status(400).json({ error: '예약 ID 필요' });

  db.get('SELECT * FROM reservations WHERE id = ?', [reservation_id], (err, rsv) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rsv) return res.status(404).json({ error: '예약 없음' });

    db.get('SELECT id FROM checkins WHERE reservation_id = ?', [reservation_id], (err2, exist) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (exist) return res.status(400).json({ error: '이미 체크인된 예약입니다' });

      db.run(`
        INSERT INTO checkins (reservation_id, pay_method, pay_amount, extra_charge, extra_memo)
        VALUES (?, ?, ?, ?, ?)
      `, [reservation_id, pay_method, pay_amount, extra_charge || 0, extra_memo || ''],
      function(err3) {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ success: true, checkin_id: this.lastID });
      });
    });
  });
});

// 날짜별 체크인 내역 조회 (관리자)
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜 필요' });

  db.all(`
    SELECT ci.*, r.people_count, r.holes,
           ts.slot_date, ts.slot_time, c.name, c.phone
    FROM checkins ci
    JOIN reservations r ON r.id = ci.reservation_id
    JOIN tee_slots ts   ON ts.id = r.slot_id
    JOIN customers c    ON c.id  = r.customer_id
    WHERE ts.slot_date = ?
    ORDER BY ts.slot_time
  `, [date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;