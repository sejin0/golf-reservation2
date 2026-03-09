import { Outlet, Link, useLocation } from 'react-router-dom';

export default function CustomerLayout() {
  const { pathname } = useLocation();

  const nav = [
    { to: '/',    label: '🏠 홈' },
    { to: '/my',  label: '📋 내 예약' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <header className="bg-green-700 text-white shadow">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-start">
          <Link to="/" className="text-xl font-bold tracking-tight">⛳ 파3 골프장</Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* 하단 네비게이션 (모바일) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex md:hidden">
        {nav.map(n => (
          <Link
            key={n.to}
            to={n.to}
            className={`flex-1 py-3 text-center text-sm font-medium
              ${pathname === n.to ? 'text-green-700 border-t-2 border-green-700' : 'text-gray-500'}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      {/* 하단 여백 (모바일 nav 가림 방지) */}
      <div className="h-16 md:hidden" />
    </div>
  );
}
