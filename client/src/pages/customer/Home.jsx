import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

export default function Home() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate(`/teetime?date=${date}`);
  };

  return (
    <div className="flex flex-col items-center gap-6 pt-8">
      {/* 타이틀 */}
      <div className="text-center">
        <div className="text-5xl mb-3">⛳</div>
        <h1 className="text-2xl font-bold text-green-700">파3 골프장 예약</h1>
        <p className="text-gray-500 mt-1 text-sm">날짜를 선택하고 티타임을 예약하세요</p>
      </div>

      {/* 날짜 선택 */}
      <div className="w-full bg-white rounded-2xl shadow p-5">
        <label className="block text-sm font-medium text-gray-600 mb-2">📅 날짜 선택</label>
        <input
          type="date"
          value={date}
          min={dayjs().format('YYYY-MM-DD')}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* 조회 버튼 */}
      <button
        onClick={handleSearch}
        className="w-full bg-green-700 hover:bg-green-800 text-white text-lg font-semibold py-4 rounded-2xl shadow transition"
      >
        티타임 조회하기
      </button>

      {/* 내 예약 확인 */}
      <button
        onClick={() => navigate('/my')}
        className="w-full bg-white hover:bg-gray-50 text-green-700 text-base font-medium py-3 rounded-2xl shadow border border-green-200 transition"
      >
        📋 내 예약 확인하기
      </button>
    </div>
  );
}
