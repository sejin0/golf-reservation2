const { Pool } = require('pg');
require('dotenv').config(); // .env 파일의 변수를 읽어옵니다.

// Railway의 DATABASE_URL을 사용하여 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Railway 외부 접속(로컬 테스트) 시 필수
  }
});

module.exports = {
  // 다른 파일에서 db.query(...) 형태로 사용할 수 있게 내보냅니다.
  query: (text, params) => pool.query(text, params),
};