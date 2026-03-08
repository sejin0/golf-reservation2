import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

/* ═══════════════════════════════════════════════════
   메인 컴포넌트: 예약 현황
═══════════════════════════════════════════════════ */
export default function ReservationMgmt() {
  const [date, setDate]           = useState(dayjs().format('YYYY-MM-DD'));
  const [slots, setSlots]         = useState([]);
  const [mainList, setMainList]   = useState([]);   // 주예약 목록
  const [joinList, setJoinList]   = useState([]);   // 조인예약 목록
  const [loading, setLoading]     = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const loadData = useCallback(async (d) => {
    setLoading(true);
    try {
      const [slotsRes, rsvRes] = await Promise.all([
        api.get(`/teetimes?date=${d}`),
        api.get(`/reservations?date=${d}`),
      ]);
      setSlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);
      setMainList(Array.isArray(rsvRes.data?.main) ? rsvRes.data.main : []);
      setJoinList(Array.isArray(rsvRes.data?.join) ? rsvRes.data.join : []);
    } catch {
      alert('조회 실패');
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

  /* ── 요약 통계 ── */
  const totalMainPeople = mainList.reduce((s, r) => s + r.people_count, 0);
  const totalJoinPeople = joinList.reduce((s, r) => s + r.people_count, 0);
  const totalPeople     = totalMainPeople + totalJoinPeople;

  /* ── 슬롯 UI 헬퍼 ── */
  const slotHeaderBg = (slot) => {
    if (slot.status === 'closed') return 'bg-gray-100';
    if (slot.status === 'full')   return 'bg-red-50';
    return 'bg-green-50';
  };

  const slotBadge = (slot) => {
    if (slot.status === 'closed')              return { label: '마감',    cls: 'bg-gray-200 text-gray-500' };
    if (slot.status === 'full')                return { label: '만석',    cls: 'bg-red-100  text-red-600'  };
    if ((slot.reserved_count || 0) > 0)        return { label: '예약있음', cls: 'bg-blue-100 text-blue-600' };
    return                                            { label: '빈자리',  cls: 'bg-green-100 text-green-600' };
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 예약 현황</h1>

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

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { val: slots.length,     lbl: '슬롯',    cls: 'text-green-700' },
          { val: mainList.length,  lbl: '팀예약',  cls: 'text-gray-700'  },
          { val: joinList.length,  lbl: '조인',    cls: 'text-blue-600'  },
          { val: totalPeople,      lbl: '총 인원', cls: 'text-orange-500'},
        ].map(({ val, lbl, cls }) => (
          <div key={lbl} className="bg-white rounded-xl shadow p-3 text-center">
            <div className={`text-xl font-bold ${cls}`}>{val}</div>
            <div className="text-xs text-gray-400 mt-0.5">{lbl}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3 pl-1">
        💡 티타임 클릭 시 상세 정보 확인·수정 가능
      </p>

      {/* 슬롯 목록 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📭</div><p>슬롯이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slots.map(slot => {
            const mains  = mainBySlot[slot.id] || [];
            const joins  = joinBySlot[slot.id] || [];
            const badge  = slotBadge(slot);
            const hasAny = mains.length > 0 || joins.length > 0;

            return (
              <div
                key={slot.id}
                className="bg-white rounded-xl shadow overflow-hidden cursor-pointer
                           hover:shadow-md hover:ring-2 hover:ring-green-400 transition"
                onClick={() => setSelectedSlot({ slot, mains, joins, date })}
              >
                {/* 슬롯 헤더 */}
                <div className={`px-4 py-3 flex items-center justify-between ${slotHeaderBg(slot)}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg text-gray-800">{slot.slot_time}</span>
                    <span className="text-sm text-gray-500">
                      {slot.reserved_count || 0}/{slot.max_per_slot}명
                    </span>
                    {joins.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        조인 {joins.length}팀
                      </span>
                    )}
                    {slot.memo && (
                      <span className="text-xs text-gray-400 truncate max-w-[140px]" title={slot.memo}>
                        📝 {slot.memo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-gray-300 text-sm">›</span>
                  </div>
                </div>

                {/* 예약자 요약 행 */}
                {hasAny ? (
                  <div className="divide-y divide-gray-100">
                    {/* 주예약 */}
                    {mains.map(r => (
                      <div key={`m-${r.id}`} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">팀</span>
                          <span className="font-medium text-gray-800 text-sm">{r.name}</span>
                          <span className="text-xs text-gray-400">{r.phone}</span>
                        </div>
                        <span className="text-xs text-gray-500">{r.people_count}명 · {r.holes}홀</span>
                      </div>
                    ))}
                    {/* 조인예약 */}
                    {joins.map((r, idx) => (
                      <div key={`j-${r.id}`} className="px-4 py-2.5 flex items-center justify-between bg-blue-50/40">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                            조인{idx + 1}
                          </span>
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

      {/* 상세 모달 */}
      {selectedSlot && (
        <SlotDetailModal
          slot={selectedSlot.slot}
          mains={selectedSlot.mains}
          joins={selectedSlot.joins}
          date={selectedSlot.date}
          onClose={() => setSelectedSlot(null)}
          onRefresh={() => { setSelectedSlot(null); loadData(date); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   티타임 상세 모달
═══════════════════════════════════════════════════ */
function SlotDetailModal({ slot, mains, joins, date, onClose, onRefresh }) {
  const [feeInfo, setFeeInfo]       = useState(null);
  const [memo, setMemo]             = useState(slot.memo || '');
  const [savingMemo, setSavingMemo] = useState(false);

  /* 취소 확인 상태 */
  const [cancelTarget, setCancelTarget] = useState(null);
  // { id, type: 'main'|'join', name, joinCount? }

  /* 예약 수정 상태 */
  const [editTarget, setEditTarget] = useState(null);
  // { id, type: 'main'|'join', people_count, holes, memo }

  useEffect(() => {
    api.get(`/greenfee/resolve?date=${date}`)
      .then(r => setFeeInfo(r.data))
      .catch(() => {});
  }, [date]);

  /* ── 그린피 계산 ── */
  const calcFee = (r) => {
    if (!feeInfo) return null;
    return (r.holes === 18 ? feeInfo.fee_18 : feeInfo.fee_9) * r.people_count;
  };

  /* ── 합산 ── */
  const totalFee    = [...mains, ...joins].reduce((s, r) => s + (calcFee(r) || 0), 0);
  const totalPeople = [...mains, ...joins].reduce((s, r) => s + r.people_count, 0);

  /* ── 주예약 취소 (연결 조인도 함께 취소) ── */
  const handleCancelMain = async (id) => {
    try {
      await api.patch(`/reservations/${id}/cancel`);
      setCancelTarget(null);
      onRefresh();
    } catch (e) { alert(e.response?.data?.error || '취소 실패'); }
  };

  /* ── 조인예약 개별 취소 ── */
  const handleCancelJoin = async (id) => {
    try {
      await api.patch(`/join/${id}/cancel`);
      setCancelTarget(null);
      onRefresh();
    } catch (e) { alert(e.response?.data?.error || '취소 실패'); }
  };

  /* ── 예약 수정 제출 ── */
  const handleEditSubmit = async () => {
    if (!editTarget) return;
    const { id, type, people_count, holes, memo: eMemo } = editTarget;
    const pc = Number(people_count);

    try {
      if (type === 'main') {
        if (pc < 2) return alert('팀예약은 최소 2명입니다');
        await api.put(`/reservations/${id}`, { people_count: pc, holes: Number(holes), memo: eMemo });
      } else {
        if (pc < 1) return alert('조인은 최소 1명입니다');
        if (pc > 2) return alert('조인 1팀은 최대 2명입니다');
        await api.put(`/join/${id}`, { people_count: pc, holes: Number(holes), memo: eMemo });
      }
      setEditTarget(null);
      onRefresh();
    } catch (e) { alert(e.response?.data?.error || '수정 실패'); }
  };

  /* ── 슬롯 메모 저장 ── */
  const handleSaveMemo = async () => {
    setSavingMemo(true);
    try {
      await api.patch(`/teetimes/${slot.id}`, { memo });
      alert('메모가 저장되었습니다');
    } catch {
      alert('메모 저장 실패');
    } finally {
      setSavingMemo(false);
    }
  };

  const statusLabel = { open: '운영중', closed: '마감', full: '만석' }[slot.status] || '';
  const statusCls   = slot.status === 'closed' ? 'bg-gray-100 text-gray-500'
                    : slot.status === 'full'    ? 'bg-red-100  text-red-600'
                    :                             'bg-green-100 text-green-600';

  /* ── 취소 버튼 컴포넌트 ── */
  const CancelBtn = ({ id, type, name, joinCount = 0 }) => {
    const isTarget = cancelTarget?.id === id && cancelTarget?.type === type;
    if (isTarget) return (
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => type === 'main' ? handleCancelMain(id) : handleCancelJoin(id)}
          className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
        >확인</button>
        <button
          onClick={() => setCancelTarget(null)}
          className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
        >취소</button>
      </div>
    );
    return (
      <button
        onClick={() => setCancelTarget({ id, type, name, joinCount })}
        className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition shrink-0"
      >취소</button>
    );
  };

  /* ── 취소 확인 알림 배너 ── */
  const CancelConfirmBanner = () => {
    if (!cancelTarget) return null;
    const isMain = cancelTarget.type === 'main';
    return (
      <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">{isMain ? '⚠️' : '🗑️'}</div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {isMain ? '팀예약 취소' : '조인예약 취소'}
            </h3>
            <p className="text-sm text-gray-600">
              <b>{cancelTarget.name}</b>님의 예약을 취소하시겠습니까?
            </p>
            {isMain && cancelTarget.joinCount > 0 && (
              <p className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                ⚠️ 팀예약 취소 시 연결된 조인예약 {cancelTarget.joinCount}팀도 함께 취소됩니다
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => cancelTarget.type === 'main'
                ? handleCancelMain(cancelTarget.id)
                : handleCancelJoin(cancelTarget.id)}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition text-sm"
            >예약 취소</button>
            <button
              onClick={() => setCancelTarget(null)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition text-sm"
            >돌아가기</button>
          </div>
        </div>
      </div>
    );
  };

  /* ── 예약 수정 모달 ── */
  const EditModal = () => {
    if (!editTarget) return null;
    const isMain = editTarget.type === 'main';
    return (
      <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            {isMain ? '🏌️ 팀예약 수정' : '🤝 조인예약 수정'}
          </h3>

          {/* 인원 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">인원 수</label>
            <div className="flex gap-2">
              {(isMain ? [2,3,4] : [1,2]).map(n => (
                <button
                  key={n}
                  onClick={() => setEditTarget(prev => ({ ...prev, people_count: n }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition border
                    ${editTarget.people_count === n
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >{n}명</button>
              ))}
            </div>
          </div>

          {/* 홀 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">홀 선택</label>
            <div className="flex gap-2">
              {[9, 18].map(h => (
                <button
                  key={h}
                  onClick={() => setEditTarget(prev => ({ ...prev, holes: h }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition border
                    ${editTarget.holes === h
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >{h}홀</button>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={editTarget.memo || ''}
              onChange={e => setEditTarget(prev => ({ ...prev, memo: e.target.value }))}
              rows={2}
              placeholder="특이사항 입력"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEditSubmit}
              className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition text-sm"
            >저장</button>
            <button
              onClick={() => setEditTarget(null)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition text-sm"
            >취소</button>
          </div>
        </div>
      </div>
    );
  };

  /* ── 예약자 카드 ── */
  const BookingCard = ({ r, type, index }) => {
    const fee    = calcFee(r);
    const isMain = type === 'main';
    // 이 주예약에 연결된 조인 수
    const linkedJoins = isMain ? joins.filter(j => j.reservation_id === r.id) : [];

    return (
      <div className={`rounded-xl p-4 ${isMain ? 'bg-gray-50 border border-gray-200' : 'bg-blue-50/50 border border-blue-100'}`}>
        {/* 상단: 배지 + 이름 + 버튼 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isMain ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                🏌️ 팀예약
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                🤝 조인 {index + 1}팀
              </span>
            )}
            <span className="font-semibold text-gray-800">{r.name}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setEditTarget({
                id: r.id,
                type,
                people_count: r.people_count,
                holes: r.holes,
                memo: r.memo || '',
              })}
              className="text-xs text-blue-400 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
            >수정</button>
            <CancelBtn
              id={r.id}
              type={type}
              name={r.name}
              joinCount={linkedJoins.length}
            />
          </div>
        </div>

        {/* 상세 정보 그리드 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">📞</span>
            <span>{r.phone}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">👥</span>
            <span><b>{r.people_count}명</b> · {r.holes}홀</span>
          </div>
          {fee != null && (
            <div className="col-span-2 flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">💰</span>
              <span className="text-green-700 font-medium">{fee.toLocaleString()}원</span>
              <span className="text-xs text-gray-400">
                ({(r.holes === 18 ? feeInfo?.fee_18 : feeInfo?.fee_9 || 0).toLocaleString()}원 × {r.people_count}명)
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

        {/* 조인 연결 표시 (주예약 카드에만) */}
        {isMain && linkedJoins.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 font-medium mb-1.5">
              🔗 연결된 조인 ({linkedJoins.length}팀)
            </p>
            <div className="flex flex-col gap-1">
              {linkedJoins.map((j, ji) => (
                <div key={j.id} className="flex items-center justify-between text-xs bg-blue-50 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-500 font-medium">조인{ji + 1}</span>
                    <span className="text-gray-700">{j.name}</span>
                    <span className="text-gray-400">{j.phone}</span>
                  </div>
                  <span className="text-gray-500">{j.people_count}명 · {j.holes}홀</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 text-xs text-gray-400">
          예약: {dayjs(r.created_at).format('MM/DD HH:mm')}
        </div>
      </div>
    );
  };

  /* ════════════════════ 렌더 ════════════════════ */
  return (
    <>
      {/* 메인 모달 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 px-4 pt-8 pb-8 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold text-green-700">{slot.slot_time}</span>
              <span className="text-sm text-gray-500">{dayjs(date).format('MM월 DD일 (ddd)')}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusCls}`}>
                {statusLabel}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >×</button>
          </div>

          <div className="p-5 flex flex-col gap-5">

            {/* 슬롯 요약 카드 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: `${totalPeople}/${slot.max_per_slot}`, lbl: '총 인원',  cls: 'text-gray-800' },
                { val: `${mains.length}팀`,                   lbl: '팀예약',   cls: 'text-green-600' },
                { val: `${joins.length}팀`,                   lbl: '조인',     cls: 'text-blue-600', bg: 'bg-blue-50' },
                { val: feeInfo ? `${(totalFee/10000).toFixed(1)}만` : '-',
                                                              lbl: '그린피',   cls: 'text-green-700' },
              ].map(({ val, lbl, cls, bg }) => (
                <div key={lbl} className={`${bg || 'bg-gray-50'} rounded-xl p-3 text-center`}>
                  <div className={`text-lg font-bold ${cls}`}>{val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{lbl}</div>
                </div>
              ))}
            </div>

            {/* 그린피 규칙 배너 */}
            {feeInfo && (
              <div className={`rounded-xl p-3 text-sm flex items-center gap-2 flex-wrap
                ${feeInfo.source === 'period'  ? 'bg-blue-50 text-blue-700' :
                  feeInfo.source === 'weekday' ? 'bg-purple-50 text-purple-700' :
                                                 'bg-gray-50 text-gray-600'}`}>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${feeInfo.source === 'period'  ? 'bg-blue-100' :
                    feeInfo.source === 'weekday' ? 'bg-purple-100' : 'bg-gray-200'}`}>
                  {feeInfo.source === 'period' ? '기간규칙' : feeInfo.source === 'weekday' ? '요일규칙' : '기본요금'}
                </span>
                {feeInfo.rule && <span className="font-medium">{feeInfo.rule.label}</span>}
                <span>9홀 <b>{(feeInfo.fee_9 || 0).toLocaleString()}원</b></span>
                <span>18홀 <b>{(feeInfo.fee_18 || 0).toLocaleString()}원</b></span>
              </div>
            )}

            {/* ── 구성 시각화: 2-1-1 같은 케이스 표시 ── */}
            {(mains.length > 0 || joins.length > 0) && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium mb-2">구성</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {mains.map((r, i) => (
                    <div key={`compose-m-${i}`} className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg font-bold text-green-700">
                        {r.people_count}
                      </div>
                      <span className="text-xs text-gray-500 mt-0.5">팀</span>
                    </div>
                  ))}
                  {joins.map((r, i) => (
                    <div key={`compose-j-${i}`} className="flex flex-col items-center">
                      {i === 0 && <div className="text-gray-400 text-xs mb-2 self-center">+</div>}
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-600">
                        {r.people_count}
                      </div>
                      <span className="text-xs text-gray-500 mt-0.5">조인{i + 1}</span>
                    </div>
                  ))}
                  <div className="flex flex-col items-center ml-1">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg font-bold text-orange-600">
                      {totalPeople}
                    </div>
                    <span className="text-xs text-gray-500 mt-0.5">합계</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 팀예약 카드 목록 ── */}
            {mains.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">🏌️ 팀예약</h3>
                <div className="flex flex-col gap-2">
                  {mains.map((r, i) => (
                    <BookingCard key={`m-${r.id}`} r={r} type="main" index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* ── 조인예약 카드 목록 ── */}
            {joins.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  🤝 조인예약 ({joins.length}팀)
                </h3>
                <div className="flex flex-col gap-2">
                  {joins.map((r, i) => (
                    <BookingCard key={`j-${r.id}`} r={r} type="join" index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* 예약 없음 */}
            {mains.length === 0 && joins.length === 0 && (
              <div className="text-center py-6 bg-gray-50 rounded-xl text-gray-400 text-sm">
                예약이 없습니다
              </div>
            )}

            {/* ── 슬롯 메모 ── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📝 슬롯 메모</h3>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={3}
                placeholder="VIP 고객, 특이사항 등"
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

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
            >닫기</button>
          </div>
        </div>
      </div>

      {/* 취소 확인 오버레이 */}
      <CancelConfirmBanner />

      {/* 수정 오버레이 */}
      <EditModal />
    </>
  );
}
