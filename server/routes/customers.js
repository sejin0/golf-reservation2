const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL 연결 설정 (db.js)

// 1. 전화번호로 고객 조회, 없으면 자동 등록
// POST /api/customers/lookup { name, phone }
router.post('/lookup', async (req, res) => {
  const { name, phone } = req.body;
  console.log('lookup 요청:', name, phone);

  if (!name || !phone) {
    return res.status(400).json({ error: '이름과 전화번호를 입력하세요' });
  }

  const normalizedPhone = String(phone).replace(/\D/g, '');
  if (normalizedPhone.length < 8) {
    return res.status(400).json({ error: '전화번호를 정확히 입력하세요' });
  }

  try {
    // 먼저 고객이 있는지 확인 ([-] 포함 여부 무관하게 숫자만 비교)
    const checkRes = await db.query(
      "SELECT * FROM customers WHERE REPLACE(phone, '-', '') = $1",
      [normalizedPhone]
    );
    
    if (checkRes.rows.length > 0) {
      // 이미 있는 고객이면 바로 반환
      return res.json(checkRes.rows[0]);
    }

    // 고객이 없으면 자동 등록 (RETURNING * 를 사용하여 저장된 행을 즉시 반환)
    const insertRes = await db.query(
      'INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING *',
      [name, normalizedPhone]
    );

    res.json(insertRes.rows[0]);
  } catch (err) {
    console.error('고객 조회/등록 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. 고객 목록 검색 (관리자)
// GET /api/customers?q=홍길동
router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const searchName = `%${q}%`;
  const normalizedPhone = q.replace(/\D/g, '');

  try {
    // PostgreSQL은 대소문자를 구분할 수 있으므로 ILIKE를 쓰면 더 편리합니다.
    const queryText = `
      SELECT * FROM customers 
      WHERE name ILIKE $1 OR REPLACE(phone, '-', '') LIKE $2 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    
    const result = await db.query(queryText, [searchName, `%${normalizedPhone}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error('고객 목록 검색 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;