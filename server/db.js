const { Pool } = require('pg');

// Railway에서 제공하는 DATABASE_URL을 사용합니다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Railway 클라우드 접속 시 필수
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};