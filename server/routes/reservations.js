const express = require('express');
const router = express.Router();
const db = require('../database');

// 예약 생성
router.post('/', (req, res) => {
  console.log('예약 요청:', req.body);
  const { slot_id, customer_id, people_count, holes, memo } = req.body;
  if (!slot_id || !customer_id || !people_count)
    return res.status(400).json({ error: '필수 항목 누락' });

  db.get('SELECT * FROM tee_slots WHERE id = ?', [slot_id], (err, slot) => {
    console.log('슬롯 조회:', err, slot);
    if (err) return res.status(500).json({ error: err.message });
    if (!slot) return res.status(404).json({ error: '티타임 없음' });
    if (slot.status === 'closed') return res.status(400).json({ error: '마감된 티타임입니다' });

    db.get('SELECT max_per_slot FROM settings WHERE id = 1', (err2, settings) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.get(`
        SELECT COALESCE(SUM(people_count), 0) AS total
        FROM reservations WHERE slot_id = ? AND status = 'confirmed'
      `, [slot_id], (err3, row) => {
        if (err3) return res.status(500).json({ error: err3.message });

        const reserved = row.total;
        if (reserved + people_count > settings.max_per_slot)
          return res.status(400).json({
            error: `최대 ${settings.max_per_slot}명까지 가능합니다. 현재 ${reserved}명 예약됨`
          });

        db.run(`
          INSERT INTO reservations (slot_id, customer_id, people_count, holes, memo)
          VALUES (?, ?, ?, ?, ?)
        `, [slot_id, customer_id, people_count, holes || 9, memo || ''], function(err4) {
          if (err4) return res.status(500).json({ error: err4.message });

          if (reserved + people_count >= settings.max_per_slot) {
            db.run("UPDATE tee_slots SET status = 'full' WHERE id = ?", [slot_id]);
          }

          db.get('SELECT * FROM reservations WHERE id = ?', [this.lastID], (err5, rsv) => {
            if (err5) return res.status(500).json({ error: err5.message });
            res.json(rsv);
          });
        });
      });
    });
  });
});

// 예약 취소
router.patch('/:id/cancel', (req, res) => {
  db.get('SELECT * FROM reservations WHERE id = ?', [req.params.id], (err, rsv) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rsv) return res.status(404).json({ error: '예약 없음' });

    db.run("UPDATE reservations SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [req.params.id], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        db.run("UPDATE tee_slots SET status='open' WHERE id=? AND status='full'", [rsv.slot_id]);
        res.json({ success: true });
      });
  });
});

// 예약 수정
router.put('/:id', (req, res) => {
  const { people_count, holes, memo } = req.body;
  db.get('SELECT * FROM reservations WHERE id = ?', [req.params.id], (err, rsv) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rsv) return res.status(404).json({ error: '예약 없음' });
    if (rsv.status === 'cancelled') return res.status(400).json({ error: '취소된 예약입니다' });

    db.get('SELECT max_per_slot FROM settings WHERE id = 1', (err2, settings) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.get(`
        SELECT COALESCE(SUM(people_count), 0) AS total FROM reservations
        WHERE slot_id = ? AND status = 'confirmed' AND id != ?
      `, [rsv.slot_id, rsv.id], (err3, row) => {
        if (err3) return res.status(500).json({ error: err3.message });

        if (row.total + people_count > settings.max_per_slot)
          return res.status(400).json({ error: '인원 초과' });

        db.run(`
          UPDATE reservations SET people_count=?, holes=?, memo=?, updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `, [people_count, holes || 9, memo, req.params.id], (err4) => {
          if (err4) return res.status(500).json({ error: err4.message });

          const newStatus = row.total + people_count >= settings.max_per_slot ? 'full' : 'open';
          db.run('UPDATE tee_slots SET status=? WHERE id=?', [newStatus, rsv.slot_id]);
          res.json({ success: true });
        });
      });
    });
  });
});

// 예약 목록 조회
router.get('/', (req, res) => {
  const { phone, date } = req.query;

  if (phone) {
    db.all(`
      SELECT r.*, ts.slot_date, ts.slot_time, c.name, c.phone
      FROM reservations r
      JOIN tee_slots ts ON ts.id = r.slot_id
      JOIN customers c  ON c.id  = r.customer_id
      WHERE c.phone = ? AND r.status = 'confirmed'
      ORDER BY ts.slot_date DESC, ts.slot_time DESC
    `, [phone], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  if (date) {
    db.all(`
      SELECT r.*, ts.slot_date, ts.slot_time, c.name, c.phone
      FROM reservations r
      JOIN tee_slots ts ON ts.id = r.slot_id
      JOIN customers c  ON c.id  = r.customer_id
      WHERE ts.slot_date = ? AND r.status = 'confirmed'
      ORDER BY ts.slot_time
    `, [date], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  res.status(400).json({ error: 'phone 또는 date 파라미터 필요' });
});

module.exports = router;