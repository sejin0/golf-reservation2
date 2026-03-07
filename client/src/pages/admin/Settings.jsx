import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Settings() {
  const [form, setForm] = useState({
    start_time: '07:00',
    end_time: '18:00',
    interval_min: 7,
    green_fee_9: 30000,
    green_fee_18: 55000,
    max_per_slot: 4,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 현재 설정 불러오기
  useEffect(() => {
    api.get('/settings')
      .then(r => setForm(r.data))
      .catch(() => alert('설정 불러오기 실패'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', form);
      alert('저장되었습니다!');
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">⚙️ 기본 설정</h1>

      <div className="flex flex-col gap-4">

        {/* 티타임 시간 설정 */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">⏰ 티타임 시간 설정</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">시작 시간</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => handleChange('start_time', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">종료 시간</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => handleChange('end_time', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">티타임 간격 (분)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.interval_min}
                  min={5} max={30}
                  onChange={e => handleChange('interval_min', Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-gray-500">분</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">슬롯당 최대 인원</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.max_per_slot}
                  min={1} max={4}
                  onChange={e => handleChange('max_per_slot', Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-gray-500">명</span>
              </div>
            </div>
          </div>
        </div>

        {/* 그린피 설정 */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">💰 그린피 설정</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">9홀 그린피</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.green_fee_9}
                  step={1000}
                  onChange={e => handleChange('green_fee_9', Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">18홀 그린피</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.green_fee_18}
                  step={1000}
                  onChange={e => handleChange('green_fee_18', Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white text-base font-semibold py-4 rounded-xl shadow transition"
        >
          {saving ? '저장 중...' : '💾 설정 저장'}
        </button>
      </div>
    </div>
  );
}