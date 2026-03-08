import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import dayjs from 'dayjs';

/* ─────────────────────── 상수 ─────────────────────── */
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const defaultForm = {
  rule_type: 'period',
  label: '',
  date_from: dayjs().format('YYYY-MM-DD'),
  date_to: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  weekdays: [],          // 체크박스 배열 [0,6] 등
  fee_9: '',
  fee_18: '',
  priority: 0,
};

/* ═══════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════ */
export default function GreenFeeSettings() {
  const [rules, setRules]         = useState([]);
  const [settings, setSettings]   = useState(null);   // 기본 설정 (fallback 표시용)
  const [loading, setLoading]     = useState(false);
  const [modal, setModal]         = useState(null);    // null | 'add' | rule객체(수정)
  const [previewDate, setPreviewDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  /* ── 데이터 로드 ── */
  const loadRules = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/greenfee'),
      api.get('/settings'),
    ]).then(([r1, r2]) => {
      setRules(Array.isArray(r1.data) ? r1.data : []);
      setSettings(r2.data);
    }).catch(() => alert('조회 실패'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  /* ── 활성/비활성 토글 ── */
  const handleToggle = async (id) => {
    try {
      await api.patch(`/greenfee/${id}/toggle`);
      loadRules();
    } catch { alert('변경 실패'); }
  };

  /* ── 삭제 ── */
  const handleDelete = async (id) => {
    if (!window.confirm('이 규칙을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/greenfee/${id}`);
      loadRules();
    } catch { alert('삭제 실패'); }
  };

  /* ── 날짜별 적용 요금 미리보기 ── */
  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data } = await api.get(`/greenfee/resolve?date=${previewDate}`);
      setPreviewResult(data);
    } catch { alert('조회 실패'); }
    finally { setPreviewLoading(false); }
  };

  /* ── 요일 라벨 ── */
  const weekdayLabel = (str) => {
    if (!str) return '-';
    return str.split(',').map(d => WEEKDAY_LABELS[Number(d)]).join(' · ');
  };

  /* ── 규칙 타입 배지 ── */
  const typeBadge = (type) => type === 'period'
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">기간</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">요일</span>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">💰 그린피 차등 설정</h1>
        <button
          onClick={() => setModal('add')}
          className="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + 규칙 추가
        </button>
      </div>

      {/* ── 기본 요금 안내 ── */}
      {settings && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm text-gray-600">
          <span className="font-semibold text-gray-700">기본 요금 (규칙 미적용 시)</span>
          <span className="ml-3">9홀 <b>{(settings.green_fee_9 || 0).toLocaleString()}원</b></span>
          <span className="ml-3">18홀 <b>{(settings.green_fee_18 || 0).toLocaleString()}원</b></span>
          <span className="ml-2 text-xs text-gray-400">← 기본설정 페이지에서 변경</span>
        </div>
      )}

      {/* ── 우선순위 안내 ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-700">
        📌 <b>적용 우선순위:</b> 기간 규칙(숫자 높을수록) &gt; 요일 규칙(숫자 높을수록) &gt; 기본 설정
      </div>

      {/* ── 날짜별 요금 미리보기 ── */}
      <div className="bg-white rounded-xl shadow p-4 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">🔍 날짜별 적용 요금 미리보기</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={previewDate}
            onChange={e => setPreviewDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white text-sm px-4 py-2 rounded-lg transition"
          >
            {previewLoading ? '조회 중...' : '확인'}
          </button>
          {previewResult && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${previewResult.source === 'period'  ? 'bg-blue-100 text-blue-700' :
                  previewResult.source === 'weekday' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-500'}`}>
                {previewResult.source === 'period'  ? '기간규칙' :
                 previewResult.source === 'weekday' ? '요일규칙' : '기본값'}
              </span>
              {previewResult.rule && (
                <span className="text-gray-600 font-medium">{previewResult.rule.label}</span>
              )}
              <span className="text-gray-700">9홀 <b className="text-green-700">{(previewResult.fee_9 || 0).toLocaleString()}원</b></span>
              <span className="text-gray-700">18홀 <b className="text-green-700">{(previewResult.fee_18 || 0).toLocaleString()}원</b></span>
            </div>
          )}
        </div>
      </div>

      {/* ── 규칙 목록 ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm">등록된 규칙이 없습니다. 규칙을 추가해 보세요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`bg-white rounded-xl shadow p-4 border-l-4 transition
                ${rule.is_active ? 'border-green-500' : 'border-gray-200 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                {/* 왼쪽 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {typeBadge(rule.rule_type)}
                    <span className="font-semibold text-gray-800">{rule.label}</span>
                    <span className="text-xs text-gray-400">우선순위 {rule.priority}</span>
                    {!rule.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">비활성</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    {rule.rule_type === 'period'
                      ? `📅 ${rule.date_from} ~ ${rule.date_to}`
                      : `📆 ${weekdayLabel(rule.weekdays)}`}
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>9홀 <b className="text-green-700">{(rule.fee_9 || 0).toLocaleString()}원</b></span>
                    <span>18홀 <b className="text-green-700">{(rule.fee_18 || 0).toLocaleString()}원</b></span>
                  </div>
                </div>

                {/* 오른쪽 버튼 */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium
                      ${rule.is_active
                        ? 'border-gray-300 text-gray-500 hover:bg-gray-50'
                        : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                  >
                    {rule.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button
                    onClick={() => setModal(rule)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition font-medium"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 추가/수정 모달 ── */}
      {modal && (
        <RuleModal
          initial={modal === 'add' ? defaultForm : {
            ...modal,
            weekdays: modal.weekdays ? modal.weekdays.split(',').map(Number) : [],
          }}
          isEdit={modal !== 'add'}
          onClose={() => setModal(null)}
          onSave={async (form) => {
            try {
              const payload = {
                ...form,
                weekdays: form.weekdays.length > 0 ? form.weekdays.join(',') : null,
                fee_9:    Number(form.fee_9),
                fee_18:   Number(form.fee_18),
                priority: Number(form.priority),
              };
              if (modal === 'add') {
                await api.post('/greenfee', payload);
              } else {
                await api.put(`/greenfee/${modal.id}`, { ...payload, is_active: modal.is_active });
              }
              setModal(null);
              loadRules();
            } catch (e) {
              alert(e.response?.data?.error || '저장 실패');
            }
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   추가/수정 모달 컴포넌트
═══════════════════════════════════════════════════ */
function RuleModal({ initial, isEdit, onClose, onSave }) {
  const [form, setForm]   = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const toggleWeekday = (d) => {
    setForm(p => ({
      ...p,
      weekdays: p.weekdays.includes(d)
        ? p.weekdays.filter(x => x !== d)
        : [...p.weekdays, d].sort(),
    }));
  };

  const handleSubmit = async () => {
    if (!form.label.trim())          return alert('규칙 이름을 입력하세요');
    if (!form.fee_9 || !form.fee_18) return alert('9홀/18홀 금액을 입력하세요');
    if (form.rule_type === 'period' && (!form.date_from || !form.date_to))
      return alert('시작일/종료일을 입력하세요');
    if (form.rule_type === 'weekday' && form.weekdays.length === 0)
      return alert('요일을 1개 이상 선택하세요');
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-800 mb-5">
          {isEdit ? '✏️ 규칙 수정' : '➕ 규칙 추가'}
        </h2>

        <div className="flex flex-col gap-4">

          {/* 규칙 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">규칙 유형</label>
            <div className="flex gap-2">
              {[
                { key: 'period',  label: '📅 기간별' },
                { key: 'weekday', label: '📆 요일별' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => set('rule_type', t.key)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition
                    ${form.rule_type === t.key
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-400'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 규칙 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">규칙 이름</label>
            <input
              type="text"
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="예: 여름 성수기, 주말 요금"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 기간 설정 */}
          {form.rule_type === 'period' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">적용 기간</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={form.date_from}
                  onChange={e => set('date_from', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-gray-400 shrink-0">~</span>
                <input
                  type="date"
                  value={form.date_to}
                  onChange={e => set('date_to', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          {/* 요일 설정 */}
          {form.rule_type === 'weekday' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">적용 요일 (복수 선택 가능)</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleWeekday(idx)}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold border transition
                      ${form.weekdays.includes(idx)
                        ? idx === 0 ? 'bg-red-500 text-white border-red-500'
                          : idx === 6 ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-green-700 text-white border-green-700'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-green-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">일=빨강, 토=파랑</p>
            </div>
          )}

          {/* 금액 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">9홀 그린피</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={form.fee_9}
                  onChange={e => set('fee_9', e.target.value)}
                  placeholder="30000"
                  step={1000}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400">원</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">18홀 그린피</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={form.fee_18}
                  onChange={e => set('fee_18', e.target.value)}
                  placeholder="55000"
                  step={1000}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400">원</span>
              </div>
            </div>
          </div>

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              우선순위 <span className="text-xs text-gray-400 font-normal">(높을수록 먼저 적용)</span>
            </label>
            <input
              type="number"
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
              min={0} max={99}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
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
              {saving ? '저장 중...' : isEdit ? '✏️ 수정 저장' : '➕ 규칙 추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
