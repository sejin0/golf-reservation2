import { useState, useEffect } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

export default function Stats() {
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [weekFrom, setWeekFrom] = useState(dayjs().startOf('week').format('YYYY-MM-DD'));
  const [weekTo, setWeekTo] = useState(dayjs().endOf('week').format('YYYY-MM-DD'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'daily') {
        res = await api.get(`/stats/daily?date=${date}`);
        setData(res.data);
      } else if (tab === 'weekly') {
        res = await api.get(`/stats/weekly?from=${weekFrom}&to=${weekTo}`);
        setData(res.data);
      } else {
        res = await api.get(`/stats/monthly?month=${month}`);
        setData(res.data);
      }
    } catch {
      alert('통계 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, [tab, date, month, weekFrom, weekTo]);

  const fmtMoney = (n) => (n || 0).toLocaleString() + '원';

  // 일별 단일 데이터
  const DailyCard = ({ d }) => (
    <div className="grid grid-cols-3 gap-3 mt-4">
      <div className="bg-white rounded-xl shadow p-4 text-center">
        <div className="text-2xl font-bold text-blue-600">{d.reservation_count}</div>
        <div className="text-xs text-gray-500 mt-1">예약 건수</div>
      </div>
      <div className="bg-white rounded-xl shadow p-4 text-center">
        <div className="text-2xl font-bold text-orange-500">{d.total_people}</div>
        <div className="text-xs text-gray-500 mt-1">예약 인원</div>
      </div>
      <div className="bg-white rounded-xl shadow p-4 text-center">
        <div className="text-lg font-bold text-green-700">{fmtMoney(d.checkin_revenue)}</div>
        <div className="text-xs text-gray-500 mt-1">체크인 매출</div>
        <div className="text-xs text-gray-400 mt-1">예상: {fmtMoney(d.expected_revenue)}</div>
        <div className="text-xs text-red-500 mt-1">미체크인: {d.unpaid_reservations}건</div>
      </div>
    </div>
  );

  // 주/월별 테이블
  const TableData = ({ rows }) => {
    const totalPeople   = rows.reduce((s, r) => s + r.total_people, 0);
    const totalExpected = rows.reduce((s, r) => s + (r.expected_revenue || 0), 0);
    const totalCheckin  = rows.reduce((s, r) => s + (r.checkin_revenue || 0), 0);
    const totalRsv      = rows.reduce((s, r) => s + r.reservation_count, 0);
    const totalUnpaid   = rows.reduce((s, r) => s + (r.unpaid_reservations || 0), 0);

    return (
      <div className="mt-4">
        {/* 합계 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{totalRsv}</div>
            <div className="text-xs text-gray-500 mt-1">총 예약</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{totalPeople}</div>
            <div className="text-xs text-gray-500 mt-1">총 인원</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-lg font-bold text-green-700">{fmtMoney(totalCheckin)}</div>
            <div className="text-xs text-gray-500 mt-1">총 체크인 매출</div>
            <div className="text-xs text-gray-400 mt-1">예상: {fmtMoney(totalExpected)}</div>
            <div className="text-xs text-red-500 mt-1">미체크인: {totalUnpaid}건</div>
          </div>
        </div>

        {/* 날짜별 테이블 */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">날짜</th>
                <th className="px-4 py-3 text-center">예약</th>
                <th className="px-4 py-3 text-center">인원</th>
                <th className="px-4 py-3 text-right">매출</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">데이터 없음</td></tr>
              ) : rows.map(r => (
                <tr key={r.date} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {dayjs(r.date).format('MM/DD (ddd)')}
                  </td>
                  <td className="px-4 py-3 text-center text-blue-600">{r.reservation_count}</td>
                  <td className="px-4 py-3 text-center text-orange-500">{r.total_people}</td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {fmtMoney(r.checkin_revenue)}
                    <div className="text-xs text-gray-400">예상 {fmtMoney(r.expected_revenue)}</div>
                    <div className="text-xs text-red-500">미체크인 {r.unpaid_reservations}건</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📈 통계</h1>

      {/* 탭 */}
      <div className="flex bg-white rounded-xl shadow p-1 mb-5 gap-1">
        {[
          { key: 'daily',   label: '일별' },
          { key: 'weekly',  label: '주별' },
          { key: 'monthly', label: '월별' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.key ? 'bg-green-700 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-xl shadow p-4 mb-2">
        {tab === 'daily' && (
          <input type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}
        {tab === 'weekly' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={weekFrom}
              onChange={e => setWeekFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <span className="text-gray-400">~</span>
            <input type="date" value={weekTo}
              onChange={e => setWeekTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        )}
        {tab === 'monthly' && (
          <input type="month" value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}
      </div>

      {/* 결과 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : data ? (
        tab === 'daily'
          ? <DailyCard d={data} />
          : <TableData rows={Array.isArray(data) ? data : []} />
      ) : null}
    </div>
  );
}