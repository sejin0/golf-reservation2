const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 4000;

// 미들웨어
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json());

// 라우터 연결
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/teetimes',      require('./routes/teetimes'));
app.use('/api/customers',     require('./routes/customers'));
app.use('/api/reservations',  require('./routes/reservations'));
app.use('/api/checkin',       require('./routes/checkin'));
app.use('/api/stats',         require('./routes/stats'));
app.use('/api/greenfee',      require('./routes/greenfee'));   // ✅ 그린피 차등 설정

// 서버 상태 확인용
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
