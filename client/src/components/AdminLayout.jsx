import { Outlet, Link, useLocation } from 'react-router-dom';

const nav = [
  { to: '/admin',              label: '📊 대시보드' },
  { to: '/admin/reservations', label: '📋 예약현황' },
  { to: '/admin/checkin',      label: '✅ 체크인' },
  { to: '/admin/teetime-setup',label: '⏰ 티타임설정' },
  { to: '/admin/settings',     label: '⚙️ 기본설정' },
  { to: '/admin/stats',        label: '📈 통계' },
];

export default function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 사이드바 (PC) */}
      <aside className="hidden md:flex flex-col w-52 bg-gray-900 text-white min-h-screen">
        <div className="px-5 py-5 text-lg font-bold border-b border-gray-700">
          ⛳ 관리자
        </div>
        {nav.map(n => (
          <Link
            key={n.to}
            to={n.to}
            className={`px-5 py-3 text-sm hover:bg-gray-700 transition
              ${pathname === n.to ? 'bg-green-700 font-semibold' : ''}`}
          >
            {n.label}
          </Link>
        ))}
        <div className="mt-auto px-5 py-4 border-t border-gray-700">
          <Link to="/" className="text-xs text-gray-400 hover:text-white">← 고객화면</Link>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col">
        {/* 모바일 상단 헤더 */}
        <header className="md:hidden bg-gray-900 text-white px-4 py-3 text-lg font-bold">
          ⛳ 관리자
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>

        {/* 모바일 하단 네비 */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 text-white flex overflow-x-auto">
          {nav.map(n => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex-shrink-0 px-3 py-2 text-xs text-center
                ${pathname === n.to ? 'text-green-400 border-t-2 border-green-400' : 'text-gray-400'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="h-12 md:hidden" />
      </div>
    </div>
  );
}
