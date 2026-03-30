const express = require('express');
const router = express.Router();
// 주의: 상단에서 새로 만든 db.js를 불러오도록 경로를 확인하세요!
const db = require('../db'); 

// 1. 설정 조회 (GET)
router.get('/', async (req, res) => {
  try {
    // PostgreSQL 결과는 항상 .rows 배열에 담겨 옵니다.
    const result = await db.query('SELECT * FROM settings WHERE id = 1');
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '설정 데이터가 없습니다.' });
    }
    
    // 첫 번째 행(row)만 반환
    res.json(result.rows[0]);
  } catch (err) {
    console.error('설정 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. 설정 저장 (PUT)
router.put('/', async (req, res) => {
  const { 
    start_time, 
    end_time, 
    interval_min, 
    green_fee_9, 
    green_fee_18, 
    max_per_slot 
  } = req.body;

  try {
    // SQLite의 '?' 대신 PostgreSQL은 '$1, $2, ...' 순서형 파라미터를 사용합니다.
    const queryText = `
      UPDATE settings SET
        start_time   = $1,
        end_time     = $2,
        interval_min = $3,
        green_fee_9  = $4,
        green_fee_18 = $5,
        max_per_slot = $6,
        updated_at   = CURRENT_TIMESTAMP
      WHERE id = 1
    `;

    const values = [
      start_time, 
      end_time, 
      interval_min, 
      green_fee_9, 
      green_fee_18, 
      max_per_slot
    ];

    await db.query(queryText, values);
    res.json({ success: true });
  } catch (err) {
    console.error('설정 저장 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;