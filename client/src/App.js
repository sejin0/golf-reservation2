import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// 고객 페이지
import Home from './pages/customer/Home';
import TeeTimeList from './pages/customer/TeeTimeList';
import ReservationForm from './pages/customer/ReservationForm';
import MyReservation from './pages/customer/MyReservation';

// 관리자 페이지
import AdminDashboard from './pages/admin/AdminDashboard';
import TeeTimeSetup from './pages/admin/TeeTimeSetup';
import ReservationMgmt from './pages/admin/ReservationMgmt';
import CheckIn from './pages/admin/CheckIn';
import Settings from './pages/admin/Settings';
import Stats from './pages/admin/Stats';

// 공통 레이아웃
import CustomerLayout from './components/CustomerLayout';
import AdminLayout from './components/AdminLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 고객 영역 */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/teetime" element={<TeeTimeList />} />
          <Route path="/reserve" element={<ReservationForm />} />
          <Route path="/my" element={<MyReservation />} />
        </Route>

        {/* 관리자 영역 */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="teetime-setup" element={<TeeTimeSetup />} />
          <Route path="reservations" element={<ReservationMgmt />} />
          <Route path="checkin" element={<CheckIn />} />
          <Route path="settings" element={<Settings />} />
          <Route path="stats" element={<Stats />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;