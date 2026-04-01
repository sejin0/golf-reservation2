import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function TeeTimeList() {
  const [params]  = useSearchParams();
  const date      = params.get('date') || dayjs().format('YYYY-MM-DD');
  const [slots, setSlots]   = useState([]);
  const [feeInfo, setFeeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate  = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/teetimes?date=${date}`),
      api.get(`/greenfee/resolve?date=${date}`),
    ]).then(([r1, r2]) => {
      setSlots(Array.isArray(r1.data) ? r1.data : []);
      setFeeInfo(r2.data || null);
    }).catch(() => alert('티타임 조회 실패')).finally(() => setLoading(false));
  }, [date]);

  /* ── 슬롯 상태 표시 정보 ── */
  const statusInfo = (slot) => {
    if (slot.status === 'closed')
      return { label: '마감', cls: 'bg-gray-100 text-gray-400' };
    if (slot.status === 'full')
      return { label: '만석', cls: 'bg-red-100 text-red-500' };
    if (slot.slot_type === 'team')
      return { label: '한팀으로 예약', cls: 'bg-indigo-100 text-indigo-700' };
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
            const isSource = !!slot.linked_slot_id;
            const isTarget = !!slot.linked_from_slot_id;
            const holeType = slot.hole_type || 9;
            const slotType = slot.slot_type || 'join';
            const effectiveSlot = {
              ...slot,
              status: isTarget ? 'full' : slot.status,
              remain: isTarget ? 0 : slot.remain,
            };
            const si = statusInfo(effectiveSlot);
            const basePrice = holeType === 18 ? feeInfo?.fee_18 : feeInfo?.fee_9;
            const teamPrice = slot.team_fee ?? basePrice;
            const joinPrice = slot.join_fee ?? basePrice;
            const actualPrice = slot.actual_price ?? (slotType === 'team' ? teamPrice : joinPrice);
            const slotEvent = slot.event || slot.memo || '';
            const canTeam = isTarget ? false : slotType === 'team' ? true : slot.can_team === 1;
            const canJoin = isTarget ? false : slotType === 'join' ? true : slot.can_join === 1;
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
                    {isSource && (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        18홀 (연계)
                      </span>
                    )}
                    {isTarget && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        연계 후행 (만석)
                      </span>
                    )}
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {holeType}홀
                    </span>
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      실제가격 {actualPrice?.toLocaleString() ?? '-'}원
                    </span>
                    {slot.slot_type === 'team' ? (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        팀예약
                      </span>
                    ) : (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        조인예약
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${si.cls}`}>
                      {si.label}
                    </span>
                  </div>
                </div>

                {/* 가격 / 안내 */}
                <div className="mb-3 text-sm text-gray-600">
                  <div>
                    {slotType === 'team'
                      ? `팀요금: ${teamPrice?.toLocaleString() ?? '-'}원`
                      : `조인요금: ${joinPrice?.toLocaleString() ?? '-'}원`}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">* 수동카트 운영(무료) *</div>
                  {slotType === 'team' ? (
                    <div className="mt-1 text-xs text-indigo-700">한팀으로 예약</div>
                  ) : (
                    <div className="mt-1 text-xs text-blue-700">현장에서 조인될 수 있는 예약</div>
                  )}
                  {slotEvent && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
                      이벤트: {slotEvent}
                    </div>
                  )}
                </div>

                {/* 하단: 버튼 */}
                {!inactive && (
                  <div className="flex gap-2">
                    {/* 팀예약 버튼 */}
                    {canTeam && (
                      <div className="flex flex-col flex-1">
                        <button
                          onClick={() => navigate(
                            `/reserve?slotId=${slot.id}&date=${date}&time=${slot.slot_time}&type=team`
                          )}
                          className="w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition"
                        >
                          🏌️ 팀예약
                          <span className="text-xs font-normal ml-1 opacity-80">(2인 이상)</span>
                        </button>
                        <div className="text-xs text-gray-500 mt-1">한팀으로 구매하는 티타임입니다.</div>
                      </div>
                    )}

                    {/* 조인예약 버튼 */}
                    {canJoin && (
                      <div className="flex flex-col flex-1">
                        <button
                          onClick={() => navigate(
                            `/join?slotId=${slot.id}&date=${date}&time=${slot.slot_time}&remain=${slot.remain}`
                          )}
                          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
                        >
                          🤝 조인예약
                          <span className="text-xs font-normal ml-1 opacity-80">({slot.remain}자리)</span>
                        </button>
                        <div className="text-xs text-gray-500 mt-1">현장에서 조인될 수 있는 예약입니다.</div>
                      </div>
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
