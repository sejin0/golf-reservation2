import { useState, useEffect } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function TeeTimeSetup() {
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [to, setTo]     = useState(dayjs().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  // 설정 불러오기
  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data));
  }, []);

  // 날짜별 슬롯 조회
  const loadSlots = (date) => {
    setLoading(true);
    api.get(`/teetimes?date=${date}`)
      .then(r => setSlots(Array.isArray(r.data) ? r.data : []))
      .catch(() => alert('조회 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate]);

  // 슬롯 자동 생성
  const handleGenerate = async () => {
    if (!from || !to) return alert('날짜를 선택하세요');
    if (dayjs(to).isBefore(dayjs(from))) return alert('종료일이 시작일보다 빠릅니다');
    setGenerating(true);
    try {
      const { data } = await api.post('/teetimes/generate', { from, to });
      alert(`${data.created}개 슬롯이 생성되었습니다!`);
      loadSlots(selectedDate);
    } catch {
      alert('생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  // 슬롯 상태 변경 (open/closed)
  const toggleSlot = async (slot) => {
    const newStatus = slot.status === 'closed' ? 'open' : 'closed';
    try {
      await api.patch(`/teetimes/${slot.id}`, { status: newStatus });
      loadSlots(selectedDate);
    } catch {
      alert('변경 실패');
    }
  };

  const statusStyle = (status) => {
    if (status === 'closed') return 'bg-gray-100 text-gray-400 line-through';
    if (status === 'full')   return 'bg-red-50 text-red-500';
    return 'bg-green-50 text-green-700';
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">⏰ 티타임 설정</h1>

      {/* 현재 설정 요약 */}
      {settings && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-700">
          현재 설정: {settings.start_time} ~ {settings.end_time} / {settings.interval_min}분 간격
        </div>
      )}

      {/* 슬롯 자동 생성 */}
      <div className="bg-white rounded-xl shadow p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">📅 슬롯 자동 생성</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">시작일</label>
            <input
              type="date" value={from}
              onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">종료일</label>
            <input
              type="date" value={to}
              onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition mt-1"
          >
            {generating ? '생성 중...' : '🔄 슬롯 자동 생성'}
          </button>
        </div>
      </div>

      {/* 날짜별 슬롯 조회 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">🕐 날짜별 슬롯 관리</h2>
        <input
          type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {loading ? (
          <div className="text-center py-8 text-gray-400">불러오는 중...</div>
        ) : slots.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm">슬롯이 없습니다. 위에서 생성해 주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map(slot => (
              <button
                key={slot.id}
                onClick={() => slot.status !== 'full' && toggleSlot(slot)}
                disabled={slot.status === 'full'}
                className={`py-3 rounded-lg text-sm font-medium transition border
                  ${statusStyle(slot.status)}
                  ${slot.status === 'full' ? 'cursor-not-allowed border-red-200' : 'cursor-pointer hover:opacity-80 border-transparent'}`}
              >
                <div>{slot.slot_time}</div>
                <div className="text-xs mt-1 opacity-70">
                  {slot.status === 'closed' ? '마감' :
                   slot.status === 'full'   ? '만석' :
                   `${slot.reserved_count}/${slot.max_per_slot}`}
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">* 슬롯 클릭시 열기/마감 전환 (만석은 변경 불가)</p>
      </div>
    </div>
  );
}