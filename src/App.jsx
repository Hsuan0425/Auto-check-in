import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'

// 後台頁面
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './components/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Events from './pages/admin/Events'
import EventDetail from './pages/admin/EventDetail'
import Registrants from './pages/admin/Registrants'
import CheckinRecords from './pages/admin/CheckinRecords'
import Sessions from './pages/admin/Sessions'
import Analytics from './pages/admin/Analytics'

// PWA 手機端
import PwaLogin from './pages/pwa/PwaLogin'
import PwaLayout from './components/pwa/PwaLayout'
import CheckinMain from './pages/pwa/CheckinMain'
import CheckinResult from './pages/pwa/CheckinResult'
import PwaStats from './pages/pwa/PwaStats'
import VipList from './pages/pwa/VipList'

// 受保護路由：需登入才能進入後台
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/admin/login" replace />
  return children
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: '"Noto Sans TC", sans-serif',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#4f46e5', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* 根路徑導向後台 */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* 後台登入 */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* 後台（受保護） */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:eventId" element={<EventDetail />} />
            <Route path="events/:eventId/registrants" element={<Registrants />} />
            <Route path="events/:eventId/checkins" element={<CheckinRecords />} />
            <Route path="events/:eventId/sessions" element={<Sessions />} />
            <Route path="events/:eventId/analytics" element={<Analytics />} />
          </Route>

          {/* PWA 手機端 */}
          <Route path="/app" element={<PwaLogin />} />
          <Route path="/app/checkin" element={<PwaLayout />}>
            <Route index element={<CheckinMain />} />
            <Route path="result" element={<CheckinResult />} />
            <Route path="stats" element={<PwaStats />} />
            <Route path="vip" element={<VipList />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
