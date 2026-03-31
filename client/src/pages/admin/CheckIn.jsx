import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

/* ═══════════════════════════════════════════════════
   메인 컴포넌트: 체크인
═══════════════════════════════════════════════════ */
export default function CheckIn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get('date') || dayjs().format('YYYY-MM-DD'));
  const [slots, setSlots]       = useState([]);
  const [mainList, setMainList] = useState([]);
  const [joinList, setJoinList] = useState([]);
  const [checkins, setCheckins] = useState({});   // key: "main_id" or "join_jid"
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(null); // { booking, type: 'main'|'join' }

  const loadData = useCallback(async (d) => {
    setLoading(true);
    try {
      const [slotsRes, rsvRes, ciRes] = await Promise.all([
        api.get(`/teetimes?date=${d}`),
        api.get(`/reservations?date=${d}`),
        api.get(`/checkin?date=${d}`),
      ]);

      setSlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);
      setMainList(Array.isArray(rsvRes.data?.main) ? rsvRes.data.main : []);
      setJoinList(Array.isArray(rsvRes.data?.join) ? rsvRes.data.join : []);

      // 체크인 맵 생성
      const ciMap = {};
      const ciData = ciRes.data || {};
      (ciData.main || []).forEach(c => { ciMap[`main_${c.reservation_id}`] = c; });
      (ciData.join || []).forEach(c => { ciMap[`join_${c.join_reservation_id}`] = c; });
      setCheckins(ciMap);
    } catch {
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(date); }, [date, loadData]);

  useEffect(() => {
    const qDate = searchParams.get('date');
    if (qDate && qDate !== date) {
      setDate(qDate);
    }
  }, [searchParams, date]);

  // 슬롯별 그룹핑
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

  const totalBookings  = mainList.length + joinList.length;
  const checkedInCount = Object.keys(checkins).length;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">✅ 체크인 / 결제</h1>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-xl shadow p-4 mb-5 flex items-center gap-3 flex-wrap">
        <input
          type="date" value={date}
          onChange={e => {
            const d = e.target.value;
            setDate(d);
            setSearchParams({ date: d });
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-sm text-gray-500">
          체크인 <b className="text-green-700">{checkedInCount}</b>/{totalBookings}건
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📭</div><p>슬롯이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {slots.map(slot => {
            const mains = mainBySlot[slot.id] || [];
            const joins = joinBySlot[slot.id] || [];
            if (mains.length === 0 && joins.length === 0) return null;

            return (
              <div key={slot.id} className="bg-white rounded-xl shadow overflow-hidden">
                {/* 슬롯 헤더 */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-bold text-green-700">{slot.slot_time}</span>
                  <span className="text-xs text-gray-400">
                    {slot.reserved_count || 0}/{slot.max_per_slot}명
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* 팀예약 체크인 행 */}
                  {mains.map(r => {
                    const ci = checkins[`main_${r.id}`];
                    return (
                      <CheckInRow
                        key={`m-${r.id}`}
                        booking={r}
                        type="main"
                        ci={ci}
                        onCheckIn={() => setModal({ booking: r, type: 'main' })}
                      />
                    );
                  })}
                  {/* 조인예약 체크인 행 */}
                  {joins.map(r => {
                    const ci = checkins[`join_${r.id}`];
                    return (
                      <CheckInRow
                        key={`j-${r.id}`}
                        booking={r}
                        type="join"
                        ci={ci}
                        onCheckIn={() => setModal({ booking: r, type: 'join' })}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 결제 모달 */}
      {modal && (
        <PayModal
          booking={modal.booking}
          bookingType={modal.type}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); loadData(date); }}
        />
      )}
    </div>
  );
}

/* ── 체크인 행 컴포넌트 ── */
function CheckInRow({ booking: r, type, ci, onCheckIn }) {
  const isMain = type === 'main';
  return (
    <div className={`px-4 py-3 flex items-center justify-between
      ${ci ? 'bg-green-50/40' : ''}`}>
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium
            ${isMain ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
            {isMain ? '팀' : '조인'}
          </span>
          <span className="font-medium text-gray-800">{r.name}</span>
          <span className="text-xs text-gray-400">{r.phone}</span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {r.people_count}명 · {r.holes}홀
        </div>
      </div>

      {ci ? (
        <div className="text-right">
          <div className="text-xs text-green-600 font-medium">✅ 완료</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {ci.pay_method === 'cash' ? '현금' :
             ci.pay_method === 'card' ? '카드' : '계좌이체'}{' '}
            {(ci.pay_amount || 0).toLocaleString()}원
          </div>
          {ci.extra_charge > 0 && (
            <div className="text-xs text-red-500">+{ci.extra_charge.toLocaleString()}원</div>
          )}
        </div>
      ) : (
        <button
          onClick={onCheckIn}
          className={`text-white text-sm font-medium px-4 py-2 rounded-lg transition
            ${isMain
              ? 'bg-green-700 hover:bg-green-800'
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          체크인
        </button>
      )}
    </div>
  );
}

/* ── 결제 입력 모달 ── */
function PayModal({ booking: r, bookingType, onClose, onDone }) {
  const [payMethod, setPayMethod]   = useState('cash');
  const [payAmount, setPayAmount]   = useState('');
  const [extraCharge, setExtra]     = useState('');
  const [extraMemo, setExtraMemo]   = useState('');
  const [saving, setSaving]         = useState(false);
  const isMain = bookingType === 'main';

  const handleSubmit = async () => {
    if (!payAmount) return alert('결제 금액을 입력하세요');
    setSaving(true);
    try {
      await api.post('/checkin', {
        ...(isMain
          ? { reservation_id: r.id }
          : { join_reservation_id: r.id }),
        pay_method:   payMethod,
        pay_amount:   Number(payAmount),
        extra_charge: Number(extraCharge) || 0,
        extra_memo:   extraMemo,
      });
      onDone();
    } catch (e) {
      alert(e.response?.data?.error || '체크인 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">💳 결제 입력</h2>
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${isMain ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
            {isMain ? '팀예약' : '조인예약'}
          </span>
          <span className="text-sm text-gray-500">
            {r.name} · {r.people_count}명 · {r.holes}홀
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {/* 결제 방법 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">결제 방법</label>
            <div className="flex gap-2">
              {[{k:'cash',l:'현금'},{k:'card',l:'카드'},{k:'transfer',l:'계좌이체'}].map(m => (
                <button
                  key={m.k}
                  onClick={() => setPayMethod(m.k)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition
                    ${payMethod === m.k ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >{m.l}</button>
              ))}
            </div>
          </div>

          {/* 결제 금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">결제 금액</label>
            <div className="flex items-center gap-2">
              <input
                type="number" value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="30000"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>

          {/* 추가 금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">추가 금액</label>
            <div className="flex items-center gap-2">
              <input
                type="number" value={extraCharge}
                onChange={e => setExtra(e.target.value)}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">메모</label>
            <input
              type="text" value={extraMemo}
              onChange={e => setExtraMemo(e.target.value)}
              placeholder="위약금 사유 등"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
            >취소</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white text-sm font-semibold transition"
            >{saving ? '처리 중...' : '✅ 체크인 완료'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
