import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

export default function ReservationForm() {
  const [params]  = useSearchParams();
  const slotId    = params.get('slotId');
  const date      = params.get('date');
  const time      = params.get('time');

  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [peopleCount, setPeople]  = useState(2);   // 최소 2명
  const [slotInfo, setSlotInfo]   = useState(null);
  const [memo, setMemo]           = useState('');
  const [loading, setLoading]     = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slotId || !date) return;
    api.get(`/teetimes?date=${date}`)
      .then(r => {
        const slot = Array.isArray(r.data) ? r.data.find(s => String(s.id) === String(slotId)) : null;
        if (slot) setSlotInfo(slot);
      })
      .catch(() => {});
  }, [slotId, date]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) return alert('이름과 전화번호를 입력하세요');
    if (phone.replace(/-/g, '').length < 10) return alert('전화번호를 정확히 입력하세요');
    if (peopleCount < 2) return alert('팀예약은 최소 2명부터 가능합니다');

    setLoading(true);
    try {
      // 1. 고객 조회/등록
      const { data: customer } = await api.post('/customers/lookup', { name, phone });

      // 2. 주예약(팀예약) 생성
      const appliedHoles = slotInfo?.hole_type || slotInfo?.holes || 9;
      await api.post('/reservations', {
        slot_id:      Number(slotId),
        customer_id:  customer.id,
        people_count: peopleCount,
        holes:        appliedHoles,
        memo,
        name:         name,
        phone:        phone,
      });

      alert(`팀예약 완료!\n${date} ${time} / ${peopleCount}명 / ${appliedHoles}홀`);
      navigate('/my?phone=' + phone);
    } catch (e) {
      alert(e.response?.data?.error || '예약 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h2 className="text-lg font-bold text-gray-800">🏌️ 팀예약</h2>
      </div>

      {/* 선택 티타임 */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
        <div className="text-sm text-green-600 font-medium mb-1">선택한 티타임</div>
        <div className="text-2xl font-bold text-green-700">{time}</div>
        <div className="text-sm text-gray-500">{dayjs(date).format('YYYY년 MM월 DD일')}</div>
      </div>

      <div className="flex flex-col gap-4">

        {/* 이름 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">대표자 이름</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* 전화번호 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">전화번호</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* 인원 — 2명 이상만 선택 가능 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            예약 인원
            <span className="text-xs text-gray-400 font-normal ml-2">최소 2명</span>
          </label>
          <div className="flex gap-2 mt-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setPeople(n)}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition
                  ${peopleCount === n
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {n}명
              </button>
            ))}
          </div>
          {peopleCount < 4 && (
            <p className="text-xs text-blue-500 mt-2">
              💡 {4 - peopleCount}자리가 남아 조인 가능 상태로 오픈됩니다
            </p>
          )}
        </div>

        {/* 홀 수 (관리자 설정값만 노출, 고객 선택 불가) */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">홀 수</label>
          <div className="text-lg font-bold text-gray-700">{slotInfo?.hole_type || slotInfo?.holes || 9}홀</div>
          <div className="text-xs text-gray-500 mt-1">(관리자가 설정한 홀 수 기준)</div>
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            메모 <span className="text-xs text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text" value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="특이사항 등"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* 예약 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white text-lg font-semibold py-4 rounded-2xl shadow transition mt-2"
        >
          {loading ? '처리 중...' : '팀예약 확정'}
        </button>
      </div>
    </div>
  );
}
