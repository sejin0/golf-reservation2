import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function TeeTimeList() {
  const [params]  = useSearchParams();
  const date      = params.get('date') || dayjs().format('YYYY-MM-DD');
  const [slots, setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate  = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get(`/teetimes?date=${date}`)
      .then(r => setSlots(Array.isArray(r.data) ? r.data : []))
      .catch(() => alert('티타임 조회 실패'))
      .finally(() => setLoading(false));
  }, [date]);

  /* ── 슬롯 상태 표시 정보 ── */
  const statusInfo = (slot) => {
    if (slot.status === 'closed')
      return { label: '마감', cls: 'bg-gray-100 text-gray-400' };
    if (slot.status === 'full')
      return { label: '만석', cls: 'bg-red-100 text-red-500' };
    return {
      label: `잔여 ${slot.remain}명`,
      cls: slot.remain <= 1 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700',
    };
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h2 className="text-lg font-bold text-gray-800">
          {dayjs(date).format('YYYY년 MM월 DD일')} 티타임
        </h2>
      </div>

      {/* 범례 */}
      <div className="flex gap-3 mb-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 팀예약 가능
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> 조인 가능
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> 만석
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> 마감
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🕐</div>
          <p>등록된 티타임이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slots.map(slot => {
            const si       = statusInfo(slot);
            const canTeam  = slot.can_team === 1;
            const canJoin  = slot.can_join === 1;
            const inactive = !canTeam && !canJoin;

            return (
              <div
                key={slot.id}
                className={`bg-white rounded-xl shadow p-4
                  ${inactive ? 'opacity-60' : ''}`}
              >
                {/* 상단: 시간 + 상태 */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-2xl font-bold text-green-700">{slot.slot_time}</span>
                    {slot.course && slot.course !== 'A' && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {slot.course}코스
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 인원 현황 */}
                    <span className="text-xs text-gray-400">
                      {slot.reserved_count}/{slot.max_per_slot}명
                      {slot.join_team_count > 0 && (
                        <span className="ml-1 text-blue-400">(조인 {slot.join_team_count}팀)</span>
                      )}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${si.cls}`}>
                      {si.label}
                    </span>
                  </div>
                </div>

                {/* 하단: 버튼 */}
                {!inactive && (
                  <div className="flex gap-2">
                    {/* 팀예약 버튼 */}
                    {canTeam && (
                      <button
                        onClick={() => navigate(
                          `/reserve?slotId=${slot.id}&date=${date}&time=${slot.slot_time}&type=team`
                        )}
                        className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition"
                      >
                        🏌️ 팀예약
                        <span className="text-xs font-normal ml-1 opacity-80">(2인 이상)</span>
                      </button>
                    )}

                    {/* 조인예약 버튼 */}
                    {canJoin && (
                      <button
                        onClick={() => navigate(
                          `/join?slotId=${slot.id}&date=${date}&time=${slot.slot_time}&remain=${slot.remain}`
                        )}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
                      >
                        🤝 조인예약
                        <span className="text-xs font-normal ml-1 opacity-80">({slot.remain}자리)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
