const express = require('express');
const router = express.Router();
const db = require('../database');

// 전화번호로 고객 조회, 없으면 자동 등록
// POST /api/customers/lookup  { name, phone }
router.post('/lookup', (req, res) => {
  const { name, phone } = req.body;
  console.log('lookup 요청:', name, phone);
  if (!name || !phone) return res.status(400).json({ error: '이름과 전화번호를 입력하세요' });

  db.get('SELECT * FROM customers WHERE phone = ?', [phone], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });

    if (customer) return res.json(customer);

    // 자동 등록
    db.run('INSERT INTO customers (name, phone) VALUES (?, ?)', [name, phone], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get('SELECT * FROM customers WHERE id = ?', [this.lastID], (err3, row) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json(row);
      });
    });
  });
});

// 고객 목록 검색 (관리자)
// GET /api/customers?q=홍길동
router.get('/', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  db.all(`
    SELECT * FROM customers
    WHERE name LIKE ? OR phone LIKE ?
    ORDER BY created_at DESC LIMIT 50
  `, [q, q], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;