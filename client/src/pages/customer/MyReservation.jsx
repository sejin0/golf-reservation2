import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function MyReservation() {
  const [params]  = useSearchParams();
  const [phone, setPhone]       = useState(params.get('phone') || '');
  const [mainList, setMainList] = useState([]);
  const [joinList, setJoinList] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (params.get('phone')) handleSearch(params.get('phone'));
  }, []);

  const handleSearch = async (p) => {
    const q = p || phone;
    if (!q.trim()) return alert('전화번호를 입력하세요');
    setLoading(true);
    try {
      const { data } = await api.get(`/reservations?phone=${q}`);
      setMainList(Array.isArray(data.main) ? data.main : []);
      setJoinList(Array.isArray(data.join) ? data.join : []);
      setSearched(true);
    } catch {
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  };

  // 주예약 취소
  const handleCancelMain = async (id) => {
    if (!window.confirm('팀예약을 취소하시겠습니까?\n연결된 조인예약도 함께 취소됩니다.')) return;
    try {
      await api.patch(`/reservations/${id}/cancel`);
      alert('취소되었습니다');
      handleSearch();
    } catch (e) {
      alert(e.response?.data?.error || '취소 실패');
    }
  };

  // 조인예약 취소
  const handleCancelJoin = async (id) => {
    if (!window.confirm('조인예약을 취소하시겠습니까?')) return;
    try {
      await api.patch(`/join/${id}/cancel`);
      alert('취소되었습니다');
      handleSearch();
    } catch (e) {
      alert(e.response?.data?.error || '취소 실패');
    }
  };

  const total = mainList.length + joinList.length;

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-5">📋 내 예약 확인</h2>

      {/* 전화번호 조회 */}
      <div className="bg-white rounded-xl shadow p-4 mb-5">
        <label className="block text-sm font-medium text-gray-600 mb-2">전화번호로 조회</label>
        <div className="flex gap-2">
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="bg-green-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-800 transition disabled:bg-gray-300"
          >
            {loading ? '...' : '조회'}
          </button>
        </div>
      </div>

      {/* 결과 */}
      {searched && (
        total === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>예약 내역이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* 팀예약 목록 */}
            {mainList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">
                  🏌️ 팀예약 ({mainList.length}건)
                </h3>
                <div className="flex flex-col gap-2">
                  {mainList.map(r => (
                    <div key={r.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-green-500">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-lg font-bold text-green-700">
                            {dayjs(r.slot_date).format('MM월 DD일')} {r.slot_time}
                          </div>
                          <div className="text-sm text-gray-600 mt-0.5">
                            {r.name} · <b>{r.people_count}명</b> · {r.holes}홀
                          </div>
                          {r.memo && (
                            <div className="text-xs text-gray-400 mt-0.5">📝 {r.memo}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            예약일시: {dayjs(r.created_at).format('MM/DD HH:mm')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelMain(r.id)}
                          className="text-xs text-red-500 border border-red-300 px-3 py-1 rounded-lg hover:bg-red-50 transition shrink-0"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 조인예약 목록 */}
            {joinList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">
                  🤝 조인예약 ({joinList.length}건)
                </h3>
                <div className="flex flex-col gap-2">
                  {joinList.map(r => (
                    <div key={r.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-400">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-lg font-bold text-blue-600">
                            {dayjs(r.slot_date).format('MM월 DD일')} {r.slot_time}
                          </div>
                          <div className="text-sm text-gray-600 mt-0.5">
                            {r.name} · <b>{r.people_count}명</b> · {r.holes}홀
                          </div>
                          {r.memo && (
                            <div className="text-xs text-gray-400 mt-0.5">📝 {r.memo}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            조인예약 · {dayjs(r.created_at).format('MM/DD HH:mm')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelJoin(r.id)}
                          className="text-xs text-red-500 border border-red-300 px-3 py-1 rounded-lg hover:bg-red-50 transition shrink-0"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
