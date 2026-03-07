import { useState, useEffect } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function ReservationMgmt() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (d) => {
    setLoading(true);
    try {
      const [slotsRes, rsvRes] = await Promise.all([
        api.get(`/teetimes?date=${d}`),
        api.get(`/reservations?date=${d}`),
      ]);
      setSlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);
      setReservations(Array.isArray(rsvRes.data) ? rsvRes.data : []);
    } catch {
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(date); }, [date]);

  const handleCancel = async (id) => {
    if (!window.confirm('예약을 취소하시겠습니까?')) return;
    try {
      await api.patch(`/reservations/${id}/cancel`);
      loadData(date);
    } catch (e) {
      alert(e.response?.data?.error || '취소 실패');
    }
  };

  // 슬롯별로 예약 그룹핑
  const slotMap = {};
  reservations.forEach(r => {
    if (!slotMap[r.slot_id]) slotMap[r.slot_id] = [];
    slotMap[r.slot_id].push(r);
  });

  const totalPeople = reservations.reduce((s, r) => s + r.people_count, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 예약 현황</h1>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-xl shadow p-4 mb-5 flex items-center gap-3">
        <input
          type="date" value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-sm text-gray-500">
          {dayjs(date).format('YYYY년 MM월 DD일')}
        </span>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{slots.length}</div>
          <div className="text-xs text-gray-500 mt-1">전체 슬롯</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{reservations.length}</div>
          <div className="text-xs text-gray-500 mt-1">예약 건수</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{totalPeople}</div>
          <div className="text-xs text-gray-500 mt-1">예약 인원</div>
        </div>
      </div>

      {/* 슬롯별 예약 목록 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📭</div>
          <p>슬롯이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slots.map(slot => {
            const rsvList = slotMap[slot.id] || [];
            const reserved = rsvList.reduce((s, r) => s + r.people_count, 0);
            return (
              <div key={slot.id} className="bg-white rounded-xl shadow overflow-hidden">
                {/* 슬롯 헤더 */}
                <div className={`px-4 py-3 flex items-center justify-between
                  ${slot.status === 'closed' ? 'bg-gray-100' :
                    slot.status === 'full'   ? 'bg-red-50' : 'bg-green-50'}`}>
                  <span className="font-bold text-lg text-gray-800">{slot.slot_time}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {reserved}/{slot.max_per_slot}명
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                      ${slot.status === 'closed' ? 'bg-gray-200 text-gray-500' :
                        slot.status === 'full'   ? 'bg-red-100 text-red-600' :
                        rsvList.length > 0       ? 'bg-blue-100 text-blue-600' :
                                                   'bg-green-100 text-green-600'}`}>
                      {slot.status === 'closed' ? '마감' :
                       slot.status === 'full'   ? '만석' :
                       rsvList.length > 0       ? '예약있음' : '빈자리'}
                    </span>
                  </div>
                </div>

                {/* 예약자 목록 */}
                {rsvList.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {rsvList.map(r => (
                      <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800">{r.name}</span>
                          <span className="text-sm text-gray-400 ml-2">{r.phone}</span>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.people_count}명 · {r.holes}홀
                            {r.memo && ` · ${r.memo}`}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="text-xs text-red-500 border border-red-300 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                        >
                          취소
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  slot.status !== 'closed' && (
                    <div className="px-4 py-3 text-sm text-gray-400">예약 없음</div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}