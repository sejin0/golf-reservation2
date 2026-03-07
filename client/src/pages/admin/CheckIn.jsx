import { useState, useEffect } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function CheckIn() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [reservations, setReservations] = useState([]);
  const [checkins, setCheckins] = useState({});
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 결제 입력 모달용 예약 데이터

  const loadData = async (d) => {
    setLoading(true);
    try {
      const [rsvRes, ciRes] = await Promise.all([
        api.get(`/reservations?date=${d}`),
        api.get(`/checkin?date=${d}`),
      ]);
      const rsvList = Array.isArray(rsvRes.data) ? rsvRes.data : [];
      const ciList  = Array.isArray(ciRes.data)  ? ciRes.data  : [];

      setReservations(rsvList);

      // 체크인 데이터를 reservation_id 로 맵핑
      const ciMap = {};
      ciList.forEach(c => { ciMap[c.reservation_id] = c; });
      setCheckins(ciMap);
    } catch {
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(date); }, [date]);

  const checkedIn = Object.keys(checkins).length;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">✅ 체크인 / 결제</h1>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-xl shadow p-4 mb-5 flex items-center gap-3">
        <input
          type="date" value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-sm text-gray-500">
          체크인 {checkedIn}/{reservations.length}명
        </span>
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📭</div>
          <p>예약이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reservations.map(r => {
            const ci = checkins[r.id];
            return (
              <div key={r.id} className={`bg-white rounded-xl shadow overflow-hidden border-l-4
                ${ci ? 'border-green-500' : 'border-gray-200'}`}>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-700">{r.slot_time}</span>
                      <span className="font-medium text-gray-800">{r.name}</span>
                      <span className="text-sm text-gray-400">{r.phone}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {r.people_count}명 · {r.holes}홀
                    </div>
                  </div>

                  {ci ? (
                    // 체크인 완료
                    <div className="text-right">
                      <div className="text-xs text-green-600 font-medium">✅ 체크인완료</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {ci.pay_method === 'cash' ? '현금' :
                         ci.pay_method === 'card' ? '카드' : '계좌이체'} {(ci.pay_amount || 0).toLocaleString()}원
                      </div>
                      {ci.extra_charge > 0 && (
                        <div className="text-xs text-red-500">
                          추가 {ci.extra_charge.toLocaleString()}원
                        </div>
                      )}
                    </div>
                  ) : (
                    // 체크인 버튼
                    <button
                      onClick={() => setModal(r)}
                      className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                    >
                      체크인
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 결제 입력 모달 */}
      {modal && (
        <PayModal
          reservation={modal}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); loadData(date); }}
        />
      )}
    </div>
  );
}

// 결제 입력 모달 컴포넌트
function PayModal({ reservation: r, onClose, onDone }) {
  const [payMethod, setPayMethod]     = useState('cash');
  const [payAmount, setPayAmount]     = useState('');
  const [extraCharge, setExtraCharge] = useState('');
  const [extraMemo, setExtraMemo]     = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async () => {
    if (!payAmount) return alert('결제 금액을 입력하세요');
    setSaving(true);
    try {
      await api.post('/checkin', {
        reservation_id: r.id,
        pay_method: payMethod,
        pay_amount: Number(payAmount),
        extra_charge: Number(extraCharge) || 0,
        extra_memo: extraMemo,
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
        <p className="text-sm text-gray-500 mb-5">
          {r.slot_time} · {r.name} · {r.people_count}명 · {r.holes}홀
        </p>

        <div className="flex flex-col gap-4">
          {/* 결제 방법 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">결제 방법</label>
            <div className="flex gap-2">
              {[
                { key: 'cash',     label: '현금' },
                { key: 'card',     label: '카드' },
                { key: 'transfer', label: '계좌이체' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition
                    ${payMethod === m.key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 결제 금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">결제 금액</label>
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

          {/* 추가 금액 (위약금 등) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">추가 금액 (위약금 등)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" value={extraCharge}
                onChange={e => setExtraCharge(e.target.value)}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">메모</label>
            <input
              type="text" value={extraMemo}
              onChange={e => setExtraMemo(e.target.value)}
              placeholder="위약금 사유 등"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white text-sm font-semibold transition"
            >
              {saving ? '처리 중...' : '✅ 체크인 완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}