import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function TeeTimeList() {
  const [params] = useSearchParams();
  const date = params.get('date') || dayjs().format('YYYY-MM-DD');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get(`/teetimes?date=${date}`)
      .then(r => setSlots(r.data))
      .catch(() => alert('티타임 조회 실패'))
      .finally(() => setLoading(false));
  }, [date]);

  const statusLabel = (slot) => {
    if (slot.status === 'closed') return { text: '마감', color: 'bg-gray-200 text-gray-500' };
    if (slot.status === 'full')   return { text: '만석', color: 'bg-red-100 text-red-500' };
    const remain = slot.max_per_slot - slot.reserved_count;
    return { text: `${remain}자리 남음`, color: 'bg-green-100 text-green-700' };
  };

  const canBook = (slot) => slot.status === 'open' && slot.reserved_count < slot.max_per_slot;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h2 className="text-lg font-bold text-gray-800">
          {dayjs(date).format('YYYY년 MM월 DD일')} 티타임
        </h2>
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
            const s = statusLabel(slot);
            return (
              <div
                key={slot.id}
                className={`bg-white rounded-xl shadow p-4 flex items-center justify-between
                  ${canBook(slot) ? 'cursor-pointer hover:shadow-md transition' : 'opacity-60'}`}
                onClick={() => canBook(slot) && navigate(`/reserve?slotId=${slot.id}&date=${date}&time=${slot.slot_time}`)}
              >
                <div>
                  <span className="text-2xl font-bold text-green-700">{slot.slot_time}</span>
                  <div className="text-xs text-gray-400 mt-1">
                    {slot.reserved_count}/{slot.max_per_slot}명 예약
                  </div>
                </div>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${s.color}`}>
                  {s.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
