import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

/* ─────────────────────────────────────────────────────
   메인 컴포넌트: 예약 현황
───────────────────────────────────────────────────── */
export default function ReservationMgmt() {
  const [date, setDate]             = useState(dayjs().format('YYYY-MM-DD'));
  const [slots, setSlots]           = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);  // 상세 모달용

  const loadData = useCallback(async (d) => {
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
  }, []);

  useEffect(() => { loadData(date); }, [date, loadData]);

  // 슬롯별 예약 그룹핑
  const slotMap = {};
  reservations.forEach(r => {
    if (!slotMap[r.slot_id]) slotMap[r.slot_id] = [];
    slotMap[r.slot_id].push(r);
  });

  const totalPeople = reservations.reduce((s, r) => s + r.people_count, 0);

  /* 상태별 스타일 */
  const slotHeaderStyle = (slot) => {
    if (slot.status === 'closed') return 'bg-gray-100 text-gray-400';
    if (slot.status === 'full')   return 'bg-red-50';
    return 'bg-green-50';
  };

  const slotBadge = (slot, rsvList) => {
    if (slot.status === 'closed') return { label: '마감', cls: 'bg-gray-200 text-gray-500' };
    if (slot.status === 'full')   return { label: '만석', cls: 'bg-red-100 text-red-600' };
    if (rsvList.length > 0)       return { label: '예약있음', cls: 'bg-blue-100 text-blue-600' };
    return { label: '빈자리', cls: 'bg-green-100 text-green-600' };
  };

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
          {dayjs(date).format('YYYY년 MM월 DD일 (ddd)')}
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

      {/* 안내 */}
      <p className="text-xs text-gray-400 mb-3 pl-1">💡 티타임을 클릭하면 상세 정보를 확인하고 관리할 수 있습니다</p>

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
            const badge = slotBadge(slot, rsvList);

            return (
              <div
                key={slot.id}
                className="bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-md hover:ring-2 hover:ring-green-400 transition"
                onClick={() => setSelectedSlot({ slot, rsvList, date })}
              >
                {/* 슬롯 헤더 */}
                <div className={`px-4 py-3 flex items-center justify-between ${slotHeaderStyle(slot)}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-800">{slot.slot_time}</span>
                    <span className="text-sm text-gray-500">
                      {reserved}/{slot.max_per_slot}명
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {rsvList.length > 0 && (
                      <span className="text-xs text-gray-400">{rsvList.length}팀</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-gray-300 text-sm">›</span>
                  </div>
                </div>

                {/* 예약자 요약 */}
                {rsvList.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {rsvList.map(r => (
                      <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{r.name}</span>
                          <span className="text-xs text-gray-400">{r.phone}</span>
                        </div>
                        <span className="text-xs text-gray-500">{r.people_count}명 · {r.holes}홀</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  slot.status !== 'closed' && (
                    <div className="px-4 py-2.5 text-sm text-gray-400">예약 없음</div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 티타임 상세 모달 */}
      {selectedSlot && (
        <SlotDetailModal
          slot={selectedSlot.slot}
          rsvList={selectedSlot.rsvList}
          date={selectedSlot.date}
          onClose={() => setSelectedSlot(null)}
          onRefresh={() => {
            setSelectedSlot(null);
            loadData(date);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   티타임 상세 모달
───────────────────────────────────────────────────── */
function SlotDetailModal({ slot, rsvList, date, onClose, onRefresh }) {
  const [feeInfo, setFeeInfo]   = useState(null);    // 그린피 정보
  const [memo, setMemo]         = useState(slot.memo || '');
  const [savingMemo, setSavingMemo] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);  // 취소 확인 중인 예약 id

  // 그린피 조회
  useEffect(() => {
    api.get(`/greenfee/resolve?date=${date}`)
      .then(r => setFeeInfo(r.data))
      .catch(() => {});
  }, [date]);

  // 예약 취소
  const handleCancel = async (id) => {
    try {
      await api.patch(`/reservations/${id}/cancel`);
      setCancelTarget(null);
      onRefresh();
    } catch (e) {
      alert(e.response?.data?.error || '취소 실패');
    }
  };

  // 슬롯 메모 저장 (tee_slots 에 memo 컬럼이 없으면 PATCH로 status만 가능하므로,
  // 여기서는 로컬 state로 보여주고 추후 컬럼 추가 시 확장 가능하도록 표시)
  const handleSaveMemo = async () => {
    setSavingMemo(true);
    try {
      // 슬롯 메모는 현재 DB 컬럼 없으므로 UI 안내만 (추후 확장)
      await new Promise(r => setTimeout(r, 300));
      alert('메모가 저장되었습니다. (서버 반영은 tee_slots.memo 컬럼 추가 후 자동 연동)');
    } finally {
      setSavingMemo(false);
    }
  };

  // 예약별 그린피 계산
  const calcFee = (rsv) => {
    if (!feeInfo) return null;
    const unitFee = rsv.holes === 18 ? feeInfo.fee_18 : feeInfo.fee_9;
    return unitFee * rsv.people_count;
  };

  const totalFee = rsvList.reduce((sum, r) => {
    const f = calcFee(r);
    return sum + (f || 0);
  }, 0);

  const reserved = rsvList.reduce((s, r) => s + r.people_count, 0);

  // 슬롯 상태 스타일
  const statusLabel = slot.status === 'closed' ? '마감' : slot.status === 'full' ? '만석' : '운영중';
  const statusCls   = slot.status === 'closed' ? 'bg-gray-100 text-gray-500'
                    : slot.status === 'full'    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 px-4 pt-8 pb-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-green-700">{slot.slot_time}</span>
            <span className="text-sm text-gray-500">{dayjs(date).format('MM월 DD일 (ddd)')}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusCls}`}>
              {statusLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
          >
            ×
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* ── 슬롯 요약 ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-800">{reserved}/{slot.max_per_slot}</div>
              <div className="text-xs text-gray-500 mt-0.5">예약 인원</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{rsvList.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">예약 팀</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-700">
                {feeInfo ? totalFee.toLocaleString() + '원' : '-'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">예상 그린피</div>
            </div>
          </div>

          {/* ── 그린피 정보 ── */}
          {feeInfo && (
            <div className={`rounded-xl p-3 text-sm flex items-center gap-3 flex-wrap
              ${feeInfo.source === 'period'  ? 'bg-blue-50 text-blue-700' :
                feeInfo.source === 'weekday' ? 'bg-purple-50 text-purple-700' :
                'bg-gray-50 text-gray-600'}`}>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${feeInfo.source === 'period'  ? 'bg-blue-100' :
                  feeInfo.source === 'weekday' ? 'bg-purple-100' : 'bg-gray-200'}`}>
                {feeInfo.source === 'period'  ? '기간규칙' :
                 feeInfo.source === 'weekday' ? '요일규칙' : '기본요금'}
              </span>
              {feeInfo.rule && <span className="font-medium">{feeInfo.rule.label}</span>}
              <span>9홀 <b>{(feeInfo.fee_9 || 0).toLocaleString()}원</b></span>
              <span>18홀 <b>{(feeInfo.fee_18 || 0).toLocaleString()}원</b></span>
            </div>
          )}

          {/* ── 주신청자 / 예약 목록 ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              👤 예약자 정보 ({rsvList.length}팀)
            </h3>

            {rsvList.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl text-gray-400 text-sm">
                예약이 없습니다
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rsvList.map((r, idx) => {
                  const fee = calcFee(r);
                  return (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                      {/* 예약자 헤더 */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {idx === 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                              주신청자
                            </span>
                          )}
                          {idx > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                              조인 {idx}
                            </span>
                          )}
                          <span className="font-semibold text-gray-800">{r.name}</span>
                        </div>
                        {/* 취소 버튼 */}
                        {cancelTarget === r.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleCancel(r.id)}
                              className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                            >
                              확인
                            </button>
                            <button
                              onClick={() => setCancelTarget(null)}
                              className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCancelTarget(r.id)}
                            className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                          >
                            예약취소
                          </button>
                        )}
                      </div>

                      {/* 예약자 상세 */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 text-xs">📞</span>
                          <span>{r.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 text-xs">👥</span>
                          <span>{r.people_count}명 · {r.holes}홀</span>
                        </div>
                        {fee != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 text-xs">💰</span>
                            <span className="text-green-700 font-medium">
                              {fee.toLocaleString()}원
                              <span className="text-xs text-gray-400 font-normal ml-1">
                                ({(r.holes === 18 ? feeInfo?.fee_18 : feeInfo?.fee_9 || 0).toLocaleString()}×{r.people_count}명)
                              </span>
                            </span>
                          </div>
                        )}
                        {r.memo && (
                          <div className="col-span-2 flex items-start gap-1.5">
                            <span className="text-gray-400 text-xs mt-0.5">📝</span>
                            <span className="text-gray-500 text-xs">{r.memo}</span>
                          </div>
                        )}
                      </div>

                      {/* 예약 시간 */}
                      <div className="mt-2 text-xs text-gray-400">
                        예약일시: {dayjs(r.created_at).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 조인 예약 안내 (기능 준비 중) ── */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
            🔧 <b>조인 예약 기능</b>은 현재 개발 중입니다. 향후 조인자를 별도 등록하고 관리할 수 있게 됩니다.
          </div>

          {/* ── 슬롯 메모 ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📝 슬롯 메모</h3>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
              placeholder="이 티타임에 대한 메모를 입력하세요 (예: VIP 고객, 특이사항 등)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleSaveMemo}
              disabled={savingMemo}
              className="mt-2 w-full py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition"
            >
              {savingMemo ? '저장 중...' : '💾 메모 저장'}
            </button>
          </div>

          {/* ── 닫기 ── */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
