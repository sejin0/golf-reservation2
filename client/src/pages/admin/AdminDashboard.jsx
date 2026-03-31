import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function AdminDashboard() {
  const [date, setDate]       = useState(dayjs().format('YYYY-MM-DD'));
  const [stats, setStats]     = useState(null);
  const [slots, setSlots]     = useState([]);
  const [mainList, setMainList] = useState([]);
  const [joinList, setJoinList] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (d) => {
    setLoading(true);
    try {
      const [statsRes, slotsRes, rsvRes] = await Promise.all([
        api.get(`/stats/daily?date=${d}`).catch(() => ({ data: null })),
        api.get(`/teetimes?date=${d}`),
        api.get(`/reservations?date=${d}`),
      ]);
      setStats(statsRes.data);
      setSlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);
      setMainList(Array.isArray(rsvRes.data?.main) ? rsvRes.data.main : []);
      setJoinList(Array.isArray(rsvRes.data?.join) ? rsvRes.data.join : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(date); }, [date, loadData]);

  /* ── 슬롯별 그룹핑 ── */
  const mainBySlot = {};
  mainList.forEach(r => {
    if (!mainBySlot[r.slot_id]) mainBySlot[r.slot_id] = [];
    mainBySlot[r.slot_id].push(r);
  });
  const joinBySlot = {};
  joinList.forEach(r => {
    if (!joinBySlot[r.slot_id]) joinBySlot[r.slot_id] = [];
    joinBySlot[r.slot_id].push(r);
  });

  /* ── 슬롯 상태 통계 ── */
  const openCount   = slots.filter(s => s.status === 'open').length;
  const fullCount   = slots.filter(s => s.status === 'full').length;
  const closedCount = slots.filter(s => s.status === 'closed').length;

  const totalMainPeople = mainList.reduce((s, r) => s + r.people_count, 0);
  const totalJoinPeople = joinList.reduce((s, r) => s + r.people_count, 0);
  const totalPeople     = totalMainPeople + totalJoinPeople;

  const quickMenus = [
    { to: '/admin/reservations', icon: '📋', label: '예약 현황',  color: 'bg-blue-50  text-blue-600'  },
    { to: '/admin/checkin',      icon: '✅', label: '체크인',     color: 'bg-green-50 text-green-600' },
    { to: '/admin/teetime-setup',icon: '⏰', label: '티타임 설정', color: 'bg-yellow-50 text-yellow-600'},
    { to: '/admin/greenfee',     icon: '💰', label: '그린피 설정', color: 'bg-purple-50 text-purple-600'},
    { to: '/admin/stats',        icon: '📊', label: '통계',       color: 'bg-orange-50 text-orange-600'},
    { to: '/admin/settings',     icon: '⚙️', label: '기본 설정',  color: 'bg-gray-50   text-gray-600'  },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">🏌️ 관리자 대시보드</h1>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-xl shadow p-4 mb-5 flex items-center gap-3 flex-wrap">
        <input
          type="date" value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-sm text-gray-500">
          {dayjs(date).format('YYYY년 MM월 DD일 (ddd)')}
        </span>
      </div>

      {/* 빠른 메뉴 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {quickMenus.map(({ to, icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className={`${color} rounded-xl p-4 text-center hover:opacity-80 transition shadow-sm font-medium text-sm`}
          >
            <div className="text-2xl mb-1">{icon}</div>
            {label}
          </Link>
        ))}
      </div>

      {/* 요약 통계 카드 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">불러오는 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* 팀/조인 인원 */}
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-400 mb-1">오늘 예약 인원</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-gray-800">{totalPeople}</span>
                <span className="text-sm text-gray-400 pb-0.5">명</span>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <span className="text-green-600">팀 {totalMainPeople}명</span>
                <span className="text-blue-500">조인 {totalJoinPeople}명</span>
              </div>
            </div>
            {/* 매출 */}
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-400 mb-1">체크인 기반 매출</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-green-700">
                  {stats?.checkin_revenue ? Math.round(stats.checkin_revenue / 10000) : 0}
                </span>
                <span className="text-sm text-gray-400 pb-0.5">만원</span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                (예상: {stats?.expected_revenue ? Math.round(stats.expected_revenue / 10000) : 0}만원)
              </div>
              <div className="mt-2 text-xs text-gray-400">
                예약 {stats?.reservation_count ?? mainList.length + joinList.length}건, 체크인 {stats?.checkin_count ?? 0}건
              </div>
            </div>
          </div>

          {/* 슬롯 상태 */}
          <div className="bg-white rounded-xl shadow p-4 mb-5">
            <p className="text-xs text-gray-400 mb-3">슬롯 현황 (총 {slots.length}개)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '운영중', val: openCount,   bg: 'bg-green-50', cls: 'text-green-600' },
                { label: '만석',   val: fullCount,   bg: 'bg-red-50',   cls: 'text-red-500'   },
                { label: '마감',   val: closedCount, bg: 'bg-gray-50',  cls: 'text-gray-400'  },
              ].map(({ label, val, bg, cls }) => (
                <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                  <div className={`text-xl font-bold ${cls}`}>{val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 오늘 예약 목록 */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">오늘의 예약</h2>
              <Link to="/admin/reservations" className="text-xs text-green-600 hover:underline">
                전체 보기 →
              </Link>
            </div>
            {mainList.length === 0 && joinList.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">예약이 없습니다</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {/* 슬롯별로 묶어서 표시 */}
                {slots
                  .filter(slot => (mainBySlot[slot.id]?.length || 0) + (joinBySlot[slot.id]?.length || 0) > 0)
                  .map(slot => {
                    const mains = mainBySlot[slot.id] || [];
                    const joins = joinBySlot[slot.id] || [];
                    const total = mains.reduce((s, r) => s + r.people_count, 0)
                                + joins.reduce((s, r) => s + r.people_count, 0);
                    return (
                      <div key={slot.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-gray-700">{slot.slot_time}</span>
                          <div className="flex items-center gap-2">
                            {joins.length > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                조인 {joins.length}팀
                              </span>
                            )}
                            <span className="text-xs text-gray-400">{total}명</span>
                          </div>
                        </div>
                        {/* 팀 예약자 */}
                        {mains.map(r => (
                          <div key={`m-${r.id}`} className="flex items-center gap-2 text-sm py-0.5">
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">팀</span>
                            <span className="text-gray-700">{r.name}</span>
                            <span className="text-gray-400 text-xs">{r.phone}</span>
                            <span className="text-gray-400 text-xs ml-auto">{r.people_count}명 · {r.holes}홀</span>
                          </div>
                        ))}
                        {/* 조인 예약자 */}
                        {joins.map((r, ji) => (
                          <div key={`j-${r.id}`} className="flex items-center gap-2 text-sm py-0.5 pl-2">
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">조인{ji+1}</span>
                            <span className="text-gray-700">{r.name}</span>
                            <span className="text-gray-400 text-xs">{r.phone}</span>
                            <span className="text-gray-400 text-xs ml-auto">{r.people_count}명 · {r.holes}홀</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
