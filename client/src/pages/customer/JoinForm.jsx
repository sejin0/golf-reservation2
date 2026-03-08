import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function JoinForm() {
  const [params]  = useSearchParams();
  const slotId    = params.get('slotId');
  const date      = params.get('date');
  const time      = params.get('time');
  const remain    = Number(params.get('remain') || 2);  // 잔여 인원

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [peopleCount, setPeople]= useState(1);
  const [holes, setHoles]       = useState(9);
  const [memo, setMemo]         = useState('');
  const [mainRsvId, setMainRsvId] = useState(null);  // 주예약 ID
  const [loading, setLoading]   = useState(false);
  const [loadingSlot, setLoadingSlot] = useState(true);
  const [slotInfo, setSlotInfo] = useState(null);

  const navigate = useNavigate();

  // 해당 슬롯의 주예약 ID 조회
  useEffect(() => {
    if (!slotId || !date) return;
    api.get(`/reservations?date=${date}`)
      .then(r => {
        // 해당 슬롯의 주예약(main) 중 첫 번째 confirmed
        const mainList = r.data?.main || [];
        const main = mainList.find(m => String(m.slot_id) === String(slotId));
        if (main) setMainRsvId(main.id);
        else alert('해당 슬롯에 주예약이 없습니다. 팀예약을 먼저 해주세요.');
      })
      .catch(() => alert('슬롯 정보 조회 실패'))
      .finally(() => setLoadingSlot(false));

    // 슬롯 현황 조회
    api.get(`/teetimes?date=${date}`)
      .then(r => {
        const slot = (r.data || []).find(s => String(s.id) === String(slotId));
        if (slot) setSlotInfo(slot);
      });
  }, [slotId, date]);

  // 잔여 인원에 따라 선택 가능 인원 계산 (1 ~ min(remain, 2))
  const maxJoin = Math.min(remain, 2);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) return alert('이름과 전화번호를 입력하세요');
    if (phone.replace(/-/g, '').length < 10) return alert('전화번호를 정확히 입력하세요');
    if (!mainRsvId) return alert('주예약 정보를 찾을 수 없습니다');
    if (peopleCount > maxJoin) return alert(`잔여 자리(${remain}명) 초과입니다`);

    setLoading(true);
    try {
      // 1. 고객 조회/등록
      const { data: customer } = await api.post('/customers/lookup', { name, phone });

      // 2. 조인예약 생성
      await api.post('/join', {
        reservation_id: mainRsvId,
        customer_id:    customer.id,
        people_count:   peopleCount,
        holes,
        memo,
      });

      alert(`조인예약 완료!\n${date} ${time} / ${peopleCount}명 / ${holes}홀`);
      navigate('/my?phone=' + phone);
    } catch (e) {
      alert(e.response?.data?.error || '조인예약 실패');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSlot) {
    return <div className="text-center py-16 text-gray-400">슬롯 정보 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h2 className="text-lg font-bold text-gray-800">🤝 조인예약</h2>
      </div>

      {/* 선택 티타임 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <div className="text-sm text-blue-600 font-medium mb-1">조인 신청 티타임</div>
        <div className="text-2xl font-bold text-blue-700">{time}</div>
        <div className="text-sm text-gray-500">{dayjs(date).format('YYYY년 MM월 DD일')}</div>
        {slotInfo && (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="text-gray-500">
              현재 {slotInfo.reserved_count}/{slotInfo.max_per_slot}명
            </span>
            <span className="text-blue-600 font-medium">
              잔여 {slotInfo.remain}자리
            </span>
            {slotInfo.join_team_count > 0 && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                조인 {slotInfo.join_team_count}팀 참여중
              </span>
            )}
          </div>
        )}
      </div>

      {/* 조인 안내 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 text-xs text-yellow-700">
        💡 조인예약은 기존 팀에 합류하는 방식입니다.
        최대 {maxJoin}명까지 신청 가능합니다.
      </div>

      <div className="flex flex-col gap-4">

        {/* 이름 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">이름</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 전화번호 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">전화번호</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 조인 인원 — 잔여에 따라 동적 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            조인 인원
            <span className="text-xs text-gray-400 font-normal ml-2">최대 {maxJoin}명</span>
          </label>
          <div className="flex gap-2 mt-2">
            {Array.from({ length: maxJoin }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPeople(n)}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition
                  ${peopleCount === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {n}명
              </button>
            ))}
          </div>
        </div>

        {/* 홀 수 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">홀 수</label>
          <div className="flex gap-3">
            {[9, 18].map(h => (
              <button
                key={h}
                onClick={() => setHoles(h)}
                className={`flex-1 py-3 rounded-lg font-semibold transition
                  ${holes === h
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {h}홀
              </button>
            ))}
          </div>
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-xl shadow p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            메모 <span className="text-xs text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text" value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="특이사항 등"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 예약 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading || !mainRsvId}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-lg font-semibold py-4 rounded-2xl shadow transition mt-2"
        >
          {loading ? '처리 중...' : '🤝 조인 확정'}
        </button>
      </div>
    </div>
  );
}
