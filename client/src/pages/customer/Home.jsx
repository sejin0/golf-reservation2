import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import dayjs from 'dayjs';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const PARTS = [
  { key: 'all', label: '전체' },
  { key: 'part1', label: '1부', range: ['05:00', '09:59'] },
  { key: 'part2', label: '2부', range: ['10:00', '13:59'] },
  { key: 'part3', label: '3부', range: ['14:00', '18:59'] },
];

export default function Home() {
  const today = dayjs();
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [feeInfo, setFeeInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePart, setActivePart] = useState(PARTS[0].key);
  const navigate = useNavigate();
  const dateRefs = useRef({});

  const selectedDay = useMemo(() => dayjs(selectedDate), [selectedDate]);
  const currentMonth = useMemo(() => selectedDay.startOf('month'), [selectedDay]);
  const months = Array.from({ length: 12 }, (_, index) => index + 1);

  const changeSelectedDate = (diff) => {
    const nextDay = selectedDay.add(diff, 'day');
    if (nextDay.isBefore(today, 'day')) return;
    setSelectedDate(nextDay.format('YYYY-MM-DD'));
  };

  const handleMonthSelect = (month) => {
    const nextDay = selectedDay.month(month - 1).date(1);
    setSelectedDate(nextDay.format('YYYY-MM-DD'));
  };

  const daysInMonth = currentMonth.daysInMonth();
  const dates = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, idx) => {
      const date = currentMonth.date(idx + 1);
      return {
        iso: date.format('YYYY-MM-DD'),
        number: date.format('D'),
        weekday: WEEKDAYS[date.day()],
        isToday: date.isSame(today, 'day'),
        disabled: date.isBefore(today, 'day'),
      };
    });
  }, [currentMonth, daysInMonth, today]);

  useEffect(() => {
    const node = dateRefs.current[selectedDate];
    if (node?.scrollIntoView) {
      node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate, dates]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/teetimes?date=${selectedDate}`),
      api.get(`/greenfee/resolve?date=${selectedDate}`),
    ]).then(([r1, r2]) => {
      setSlots(Array.isArray(r1.data) ? r1.data : []);
      setFeeInfo(r2.data || null);
    }).catch(() => alert('티타임 조회 실패')).finally(() => setLoading(false));
  }, [selectedDate]);

  const filteredSlots = useMemo(() => {
    return PARTS.reduce((acc, part) => {
      if (part.key === 'all') {
        acc[part.key] = slots;
      } else {
        const [start, end] = part.range;
        acc[part.key] = slots.filter(slot => slot.slot_time >= start && slot.slot_time <= end);
      }
      return acc;
    }, {});
  }, [slots]);

  const statusInfo = (slot) => {
    if (slot.status === 'closed') return { label: '마감', cls: 'bg-gray-100 text-gray-400' };
    if (slot.status === 'full') return { label: '만석', cls: 'bg-red-100 text-red-500' };
    if (slot.slot_type === 'team') return { label: '한팀으로 예약', cls: 'bg-indigo-100 text-indigo-700' };
    // slot_type===join or default
    return {
      label: `잔여 ${slot.remain}명`,
      cls: slot.remain <= 1 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700',
    };
  };

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">클럽명</p>
          <h1 className="text-3xl font-bold text-gray-900">스카이72 파3 골프</h1>
        </div>
        <button
          onClick={() => navigate('/my')}
          className="rounded-2xl border border-green-200 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
        >
          내 예약
        </button>
      </div>

      <div className="bg-white rounded-[32px] p-5 shadow-sm">
<div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-[130px]">
                <p className="text-xs text-gray-500">월 선택</p>
                <div className="mt-1 inline-flex items-center gap-1 rounded-2xl border border-gray-200 bg-white px-2 py-2">
                  <span className="text-xs text-gray-600">{selectedDay.year()}년</span>
                  <select
                    value={selectedDay.month() + 1}
                    onChange={(e) => handleMonthSelect(Number(e.target.value))}
                    className="bg-transparent text-sm font-semibold text-gray-900 outline-none"
                  >
                    {months.map(month => (
                      <option key={month} value={month}>{month}월</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-3xl bg-gray-100 px-2 py-2">
                <button
                  onClick={() => changeSelectedDate(-1)}
                  disabled={selectedDay.isSame(today, 'day')}
                  className="w-10 h-10 rounded-full border border-gray-200 text-gray-600 disabled:opacity-40"
                >
                  {'<'}
                </button>
                <div className="whitespace-nowrap text-sm font-semibold text-gray-900">
                  {selectedDay.format('M월 D일')} ({WEEKDAYS[selectedDay.day()]})
                </div>
                <button
                  onClick={() => changeSelectedDate(1)}
                  className="w-10 h-10 rounded-full border border-gray-200 text-gray-600"
                >
                  {'>'}
                </button>
              </div>
            </div>
          </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {dates.map(day => (
            <button
              key={day.iso}
              ref={(el) => { if (el) dateRefs.current[day.iso] = el; }}
              onClick={() => !day.disabled && setSelectedDate(day.iso)}
              className={`min-w-[60px] flex-shrink-0 rounded-3xl border p-2.5 text-center transition
                ${day.iso === selectedDate ? 'border-green-700 bg-green-700 text-white' : 'border-gray-200 bg-white text-gray-700'}
                ${day.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-green-500'}
              `}
              disabled={day.disabled}
            >
              <div className="text-xs text-gray-300">{day.weekday}</div>
              <div className="text-xl font-semibold">{day.number}</div>
              {day.isToday && <div className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">오늘</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-sm text-gray-500">선택된 날짜</p>
          <h2 className="text-xl font-bold text-gray-900">
            {dayjs(selectedDate).format('M월 D일')} ({WEEKDAYS[dayjs(selectedDate).day()]})
          </h2>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-5">
          {PARTS.map(part => (
            <button
              key={part.key}
              onClick={() => setActivePart(part.key)}
              className={`rounded-2xl py-3 text-sm font-semibold transition
                ${activePart === part.key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              `}
            >
              {part.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">불러오는 중...</div>
        ) : filteredSlots[activePart]?.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <div className="text-4xl mb-3">🕐</div>
            <p>선택한 시간대에 등록된 티타임이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSlots[activePart].map(slot => {
              const info = statusInfo(slot);
              const slotType = slot.slot_type || 'join';
              const canTeam = slotType === 'team' || (slotType === 'join' ? false : slot.can_team === 1);
              const canJoin = slotType === 'join' || (slotType === 'team' ? false : slot.can_join === 1);
              const inactive = !canTeam && !canJoin;

              return (
                <div key={slot.id} className={`rounded-3xl border p-4 ${inactive ? 'bg-gray-50 opacity-75' : 'bg-white shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-3xl font-bold text-green-700">{slot.slot_time}</div>
                      <div className="mt-2 text-sm text-gray-600">홀: {slot.hole_type || 9}홀</div>
                      <div className="mt-1 text-sm text-gray-600">실제가격 {((slot.actual_price ?? (slot.slot_type === 'team' ? slot.team_fee : slot.join_fee) ?? (slot.hole_type === 18 ? feeInfo?.fee_18 : feeInfo?.fee_9)) || 0).toLocaleString()}원</div>
                      <div className="mt-1 text-sm text-gray-600">예약형태: {slot.slot_type === 'team' ? '팀예약' : '조인예약'}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${info.cls}`}>{info.label}</span>
                  </div>

                  {/* 예약/팀/조인 요약 라인 제거 (팀은 전체 구매, 조인은 상단 잔여 표시로 대체) */}

                  {!inactive ? (
                    <div className="grid grid-cols-2 gap-2">
                      {canTeam && (
                        <button
                          onClick={() => navigate(`/reserve?slotId=${slot.id}&date=${selectedDate}&time=${slot.slot_time}&type=team`)}
                          className="rounded-2xl bg-green-700 py-3 text-sm font-semibold text-white hover:bg-green-800"
                        >
                          팀예약
                        </button>
                      )}
                      {canJoin && (
                        <button
                          onClick={() => navigate(`/join?slotId=${slot.id}&date=${selectedDate}&time=${slot.slot_time}&remain=${slot.remain}`)}
                          className="rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          조인예약
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-gray-100 py-3 text-center text-sm text-gray-500">예약 불가</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
