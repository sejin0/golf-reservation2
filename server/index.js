const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = 4000;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  credentials: true,
}));
app.use(express.json());

// 라우터
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/teetimes',     require('./routes/teetimes'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/join',         require('./routes/join'));          // ✅ 조인예약
app.use('/api/checkin',      require('./routes/checkin'));
app.use('/api/stats',        require('./routes/stats'));
app.use('/api/greenfee',     require('./routes/greenfee'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
