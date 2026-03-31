import { useState } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

function formatPhone(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export default function MemberLookup() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return alert('전화번호 또는 이름을 입력하세요');

    setLoading(true);
    try {
      const isPhone = q.replace(/\D/g, '').length >= 8;
      const url = isPhone ? `/reservations?phone=${encodeURIComponent(q)}` : `/reservations?name=${encodeURIComponent(q)}`;
      const { data } = await api.get(url);

      const merged = [...(data.main || []), ...(data.join || [])]
        .map(r => ({
          ...r,
          _displayDate: r.slot_date ? r.slot_date : r.date,
          _displayTime: r.slot_time || '',
          _type: r.booking_type || (r.slot_id && r.id ? 'main' : 'join'),
        }))
        .sort((a, b) => {
          if (a._displayDate !== b._displayDate) return b._displayDate.localeCompare(a._displayDate);
          return b._displayTime.localeCompare(a._displayTime);
        });

      setResults(merged);
      setSelected(null);
    } catch (e) {
      console.error(e);
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-5">👥 회원 예약조회</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-5">
        <p className="text-sm text-gray-500 mb-2">전화번호 또는 이름으로 예약을 조회하세요.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="010-1234-5678 또는 홍길동"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-green-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-800 transition disabled:bg-gray-300"
          >{loading ? '조회중...' : '조회'}</button>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-500">
        {results.length > 0 ? `${results.length}개 슬롯이 검색되었습니다.` : '검색 결과가 없습니다.'}
      </div>

      <div className="space-y-2">
        {results.map(item => (
          <button
            key={`${item._type}-${item.id}-${item.slot_id}`}
            onClick={() => setSelected(item)}
            className="w-full text-left bg-white rounded-xl shadow p-3 border border-gray-100 hover:border-green-300 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-800">{dayjs(item._displayDate).format('YYYY-MM-DD')} {item._displayTime}</div>
                <div className="text-xs text-gray-500">{item.name} · {formatPhone(item.phone)} · {item.people_count}명 · {item.holes}홀</div>
              </div>
              <span className={`text-xs font-semibold ${item._type === 'main' ? 'text-green-600' : 'text-blue-600'}`}>
                {item._type === 'main' ? '팀' : '조인'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold">예약 상세</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div><b>이름:</b> {selected.name}</div>
              <div><b>전화:</b> {formatPhone(selected.phone)}</div>
              <div><b>타입:</b> {selected._type === 'main' ? '팀예약' : '조인예약'}</div>
              <div><b>날짜:</b> {dayjs(selected._displayDate).format('YYYY-MM-DD')}</div>
              <div><b>시간:</b> {selected._displayTime}</div>
              <div><b>인원:</b> {selected.people_count}명</div>
              <div><b>홀:</b> {selected.holes}홀</div>
              <div><b>메모:</b> {selected.memo || '-'}</div>
              <div><b>예약일시:</b> {selected.created_at ? dayjs(selected.created_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
            >닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
