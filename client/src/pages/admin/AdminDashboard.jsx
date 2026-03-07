import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function AdminDashboard() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [stats, setStats] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadData = async (d) => {
    setLoading(true);
    try {
      const [statsRes, slotsRes, rsvRes] = await Promise.all([
        api.get(`/stats/daily?date=${d}`),
        api.get(`/teetimes?date=${d}`),
        api.get(`/reservations?date=${d}`),
      ]);
      setStats(statsRes.data);
      setSlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);
      setReservations(Array.isArray(rsvRes.data) ? rsvRes.data : []);
    } catch {
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(date); }, [date]);

  const openSlots  = slots.filter(s => s.status === 'open').length;
  const fullSlots  = slots.filter(s => s.status === 'full').length;
  const closedSlots = slots.filter(s => s.status === 'closed').length;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 대시보드</h1>
        <input
          type="date" value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : (
        <>
          {/* 오늘 요약 */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-xl shadow p-4">
              <div className="text-xs text-gray-500 mb-1">예약 건수</div>
              <div className="text-3xl font-bold text-blue-600">
                {stats?.reservation_count || 0}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="text-xs text-gray-500 mb-1">예약 인원</div>
              <div className="text-3xl font-bold text-orange-500">
                {stats?.total_people || 0}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="text-xs text-gray-500 mb-1">매출</div>
              <div className="text-2xl font-bold text-green-700">
                {(stats?.total_revenue || 0).toLocaleString()}원
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="text-xs text-gray-500 mb-1">슬롯 현황</div>
              <div className="text-sm mt-1 flex flex-col gap-1">
                <span className="text-green-600">빈자리 {openSlots}개</span>
                <span className="text-red-500">만석 {fullSlots}개</span>
                <span className="text-gray-400">마감 {closedSlots}개</span>
              </div>
            </div>
          </div>

          {/* 빠른 메뉴 */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: '📋 예약현황', path: '/admin/reservations' },
              { label: '✅ 체크인',   path: '/admin/checkin' },
              { label: '⏰ 티타임설정', path: '/admin/teetime-setup' },
              { label: '📈 통계',     path: '/admin/stats' },
            ].map(m => (
              <button
                key={m.path}
                onClick={() => navigate(m.path)}
                className="bg-white rounded-xl shadow p-4 text-left text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-700 transition"
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 오늘 예약 목록 */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700">
              오늘 예약 목록
            </div>
            {reservations.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">예약이 없습니다</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {reservations.map(r => (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-green-700 mr-2">{r.slot_time}</span>
                      <span className="text-gray-800">{r.name}</span>
                      <span className="text-gray-400 text-sm ml-2">{r.phone}</span>
                    </div>
                    <span className="text-xs text-gray-500">{r.people_count}명 · {r.holes}홀</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}