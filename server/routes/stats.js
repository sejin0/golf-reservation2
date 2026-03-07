const express = require('express');
const router = express.Router();
const db = require('../database');

// 일별 통계
router.get('/daily', (req, res) => {
  const { date } = req.query;
  db.get(`
    SELECT
      ? AS date,
      COUNT(DISTINCT r.id) AS reservation_count,
      COALESCE(SUM(r.people_count), 0) AS total_people,
      COALESCE(SUM(ci.pay_amount + COALESCE(ci.extra_charge, 0)), 0) AS total_revenue
    FROM reservations r
    JOIN tee_slots ts ON ts.id = r.slot_id
    LEFT JOIN checkins ci ON ci.reservation_id = r.id
    WHERE ts.slot_date = ? AND r.status = 'confirmed'
  `, [date, date], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || { date, reservation_count: 0, total_people: 0, total_revenue: 0 });
  });
});

// 주별 통계
router.get('/weekly', (req, res) => {
  const { from, to } = req.query;
  db.all(`
    SELECT
      ts.slot_date AS date,
      COUNT(DISTINCT r.id) AS reservation_count,
      COALESCE(SUM(r.people_count), 0) AS total_people,
      COALESCE(SUM(ci.pay_amount + COALESCE(ci.extra_charge, 0)), 0) AS total_revenue
    FROM reservations r
    JOIN tee_slots ts ON ts.id = r.slot_id
    LEFT JOIN checkins ci ON ci.reservation_id = r.id
    WHERE ts.slot_date BETWEEN ? AND ? AND r.status = 'confirmed'
    GROUP BY ts.slot_date
    ORDER BY ts.slot_date
  `, [from, to], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 월별 통계
router.get('/monthly', (req, res) => {
  const { month } = req.query;
  db.all(`
    SELECT
      ts.slot_date AS date,
      COUNT(DISTINCT r.id) AS reservation_count,
      COALESCE(SUM(r.people_count), 0) AS total_people,
      COALESCE(SUM(ci.pay_amount + COALESCE(ci.extra_charge, 0)), 0) AS total_revenue
    FROM reservations r
    JOIN tee_slots ts ON ts.id = r.slot_id
    LEFT JOIN checkins ci ON ci.reservation_id = r.id
    WHERE strftime('%Y-%m', ts.slot_date) = ? AND r.status = 'confirmed'
    GROUP BY ts.slot_date
    ORDER BY ts.slot_date
  `, [month], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;