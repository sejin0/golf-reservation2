const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL 연결 설정

/* ─────────────────── 목록 조회 GET /api/greenfee ─────────────────── */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM green_fee_rules ORDER BY priority DESC, id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ────────────── 특정 날짜 적용 요금 조회 GET /api/greenfee/resolve?date= ────────────── */
router.get('/resolve', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date 파라미터 필요' });

  try {
    // 1) 기간 규칙 (우선순위 높은 것 먼저)
    const periodRes = await db.query(`
      SELECT * FROM green_fee_rules
      WHERE rule_type='period' AND is_active=1
        AND date_from <= $1 AND date_to >= $2
      ORDER BY priority DESC, id DESC
      LIMIT 1
    `, [date, date]);

    if (periodRes.rows.length > 0) {
      const rule = periodRes.rows[0];
      return res.json({ source: 'period', rule, fee_9: rule.fee_9, fee_18: rule.fee_18 });
    }

    // 2) 요일 규칙
    const dow = new Date(date).getDay(); // 0=일 ... 6=토
    const weekdayRes = await db.query(`
      SELECT * FROM green_fee_rules
      WHERE rule_type='weekday' AND is_active=1
      ORDER BY priority DESC, id DESC
    `);

    const matched = weekdayRes.rows.find(r =>
      r.weekdays && r.weekdays.split(',').map(Number).includes(dow)
    );

    if (matched) {
      return res.json({ source: 'weekday', rule: matched, fee_9: matched.fee_9, fee_18: matched.fee_18 });
    }

    // 3) 기본 설정 fallback
    const settingsRes = await db.query('SELECT green_fee_9, green_fee_18 FROM settings WHERE id=1');
    const s = settingsRes.rows[0];
    res.json({ 
      source: 'default', 
      rule: null, 
      fee_9: s?.green_fee_9 ?? 30000, 
      fee_18: s?.green_fee_18 ?? 55000 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────── 규칙 생성 POST /api/greenfee ───────────────── */
router.post('/', async (req, res) => {
  const { rule_type, label, date_from, date_to, weekdays, fee_9, fee_18, priority } = req.body;

  if (!rule_type || !label || fee_9 == null || fee_18 == null)
    return res.status(400).json({ error: '필수 항목 누락' });

  try {
    const result = await db.query(`
      INSERT INTO green_fee_rules 
        (rule_type, label, date_from, date_to, weekdays, fee_9, fee_18, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [rule_type, label, date_from || null, date_to || null, weekdays || null, fee_9, fee_18, priority ?? 0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────── 규칙 수정 PUT /api/greenfee/:id ───────────────── */
router.put('/:id', async (req, res) => {
  const { rule_type, label, date_from, date_to, weekdays, fee_9, fee_18, is_active, priority } = req.body;
  const { id } = req.params;

  try {
    const result = await db.query(`
      UPDATE green_fee_rules
      SET rule_type=$1, label=$2, date_from=$3, date_to=$4, weekdays=$5,
          fee_9=$6, fee_18=$7, is_active=$8, priority=$9
      WHERE id=$10
      RETURNING *
    `, [rule_type, label, date_from || null, date_to || null, weekdays || null,
        fee_9, fee_18, is_active ?? 1, priority ?? 0, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: '규칙을 찾을 수 없음' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────── 규칙 삭제 DELETE /api/greenfee/:id ───────────────── */
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM green_fee_rules WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ──────── 활성/비활성 토글 PATCH /api/greenfee/:id/toggle ──────── */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE green_fee_rules 
      SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END 
      WHERE id=$1 
      RETURNING *
    `, [req.params.id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;