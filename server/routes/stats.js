const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. 일별 통계
router.get('/daily', async (req, res) => {
  const { date } = req.query;
  try {
    const query = `
      SELECT 
        COUNT(r.id)::int AS reservation_count,
        COALESCE(SUM(r.people_count), 0)::int AS total_people,
        COALESCE(SUM(ts.price * r.people_count), 0)::int AS total_revenue
      FROM reservations r
      JOIN tee_slots ts ON r.slot_id = ts.id
      WHERE ts.slot_date = $1 AND r.status = 'confirmed'
    `;
    const result = await db.query(query, [date]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. 주별/월별 통계 (PostgreSQL DATE_TRUNC 사용)
router.get('/weekly', async (req, res) => {
  const { from, to } = req.query;
  try {
    const query = `
      SELECT 
        ts.slot_date AS date,
        COUNT(r.id)::int AS reservation_count,
        COALESCE(SUM(r.people_count), 0)::int AS total_people,
        COALESCE(SUM(ts.price * r.people_count), 0)::int AS total_revenue
      FROM reservations r
      JOIN tee_slots ts ON r.slot_id = ts.id
      WHERE ts.slot_date BETWEEN $1 AND $2 AND r.status = 'confirmed'
      GROUP BY ts.slot_date
      ORDER BY ts.slot_date ASC
    `;
    const result = await db.query(query, [from, to]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. 월별 통계
router.get('/monthly', async (req, res) => {
  const { month } = req.query; // 'YYYY-MM' 형식
  try {
    const query = `
      SELECT 
        ts.slot_date AS date,
        COUNT(r.id)::int AS reservation_count,
        COALESCE(SUM(r.people_count), 0)::int AS total_people,
        COALESCE(SUM(ts.price * r.people_count), 0)::int AS total_revenue
      FROM reservations r
      JOIN tee_slots ts ON r.slot_id = ts.id
      WHERE TO_CHAR(ts.slot_date, 'YYYY-MM') = $1 AND r.status = 'confirmed'
      GROUP BY ts.slot_date
      ORDER BY ts.slot_date ASC
    `;
    const result = await db.query(query, [month]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;