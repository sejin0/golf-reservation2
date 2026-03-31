const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. 일별 통계
router.get('/daily', async (req, res) => {
  const { date } = req.query;
  try {
    const query = `
      WITH reservation_summary AS (
        SELECT
          COUNT(r.id)::int AS reservation_count,
          COALESCE(SUM(r.people_count), 0)::int AS total_people,
          COALESCE(SUM(ts.price * r.people_count), 0)::int AS expected_revenue
        FROM reservations r
        JOIN tee_slots ts ON r.slot_id = ts.id
        WHERE ts.slot_date = $1 AND r.status = 'confirmed'
      ),
      checkin_summary AS (
        SELECT
          COUNT(ci.id)::int AS checkin_count,
          COALESCE(SUM(COALESCE(ci.pay_amount, 0) + COALESCE(ci.extra_charge, 0)), 0)::int AS checkin_revenue
        FROM checkins ci
        LEFT JOIN reservations r ON r.id = ci.reservation_id
        LEFT JOIN join_reservations jr ON jr.id = ci.join_reservation_id
        LEFT JOIN tee_slots ts ON ts.id = COALESCE(r.slot_id, jr.slot_id)
        WHERE ts.slot_date = $1
      )
      SELECT
        rs.reservation_count,
        rs.total_people,
        rs.expected_revenue,
        cs.checkin_count,
        cs.checkin_revenue,
        (rs.reservation_count - cs.checkin_count)::int AS unpaid_reservations
      FROM reservation_summary rs, checkin_summary cs
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
      WITH reservation_summary AS (
        SELECT 
          ts.slot_date AS date,
          COUNT(r.id)::int AS reservation_count,
          COALESCE(SUM(r.people_count), 0)::int AS total_people,
          COALESCE(SUM(ts.price * r.people_count), 0)::int AS expected_revenue
        FROM reservations r
        JOIN tee_slots ts ON r.slot_id = ts.id
        WHERE ts.slot_date BETWEEN $1 AND $2 AND r.status = 'confirmed'
        GROUP BY ts.slot_date
      ),
      checkin_summary AS (
        SELECT
          ts.slot_date AS date,
          COUNT(ci.id)::int AS checkin_count,
          COALESCE(SUM(COALESCE(ci.pay_amount, 0) + COALESCE(ci.extra_charge, 0)), 0)::int AS checkin_revenue
        FROM checkins ci
        LEFT JOIN reservations r ON r.id = ci.reservation_id
        LEFT JOIN join_reservations jr ON jr.id = ci.join_reservation_id
        LEFT JOIN tee_slots ts ON ts.id = COALESCE(r.slot_id, jr.slot_id)
        WHERE ts.slot_date BETWEEN $1 AND $2
        GROUP BY ts.slot_date
      )
      SELECT
        rs.date,
        rs.reservation_count,
        rs.total_people,
        rs.expected_revenue,
        COALESCE(cs.checkin_count, 0)::int AS checkin_count,
        COALESCE(cs.checkin_revenue, 0)::int AS checkin_revenue,
        (rs.reservation_count - COALESCE(cs.checkin_count, 0))::int AS unpaid_reservations
      FROM reservation_summary rs
      LEFT JOIN checkin_summary cs ON cs.date = rs.date
      ORDER BY rs.date ASC
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
      WITH reservation_summary AS (
        SELECT 
          ts.slot_date AS date,
          COUNT(r.id)::int AS reservation_count,
          COALESCE(SUM(r.people_count), 0)::int AS total_people,
          COALESCE(SUM(ts.price * r.people_count), 0)::int AS expected_revenue
        FROM reservations r
        JOIN tee_slots ts ON r.slot_id = ts.id
        WHERE TO_CHAR(ts.slot_date, 'YYYY-MM') = $1 AND r.status = 'confirmed'
        GROUP BY ts.slot_date
      ),
      checkin_summary AS (
        SELECT
          ts.slot_date AS date,
          COUNT(ci.id)::int AS checkin_count,
          COALESCE(SUM(COALESCE(ci.pay_amount, 0) + COALESCE(ci.extra_charge, 0)), 0)::int AS checkin_revenue
        FROM checkins ci
        LEFT JOIN reservations r ON r.id = ci.reservation_id
        LEFT JOIN join_reservations jr ON jr.id = ci.join_reservation_id
        LEFT JOIN tee_slots ts ON ts.id = COALESCE(r.slot_id, jr.slot_id)
        WHERE TO_CHAR(ts.slot_date, 'YYYY-MM') = $1
        GROUP BY ts.slot_date
      )
      SELECT
        rs.date,
        rs.reservation_count,
        rs.total_people,
        rs.expected_revenue,
        COALESCE(cs.checkin_count, 0)::int AS checkin_count,
        COALESCE(cs.checkin_revenue, 0)::int AS checkin_revenue,
        (rs.reservation_count - COALESCE(cs.checkin_count, 0))::int AS unpaid_reservations
      FROM reservation_summary rs
      LEFT JOIN checkin_summary cs ON cs.date = rs.date
      ORDER BY rs.date ASC
    `;
    const result = await db.query(query, [month]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;