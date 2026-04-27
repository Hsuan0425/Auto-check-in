import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { PwaSessionProvider, usePwaSession } from '../../hooks/usePwaSession'
import { useEffect } from 'react'
import { QrCode, BarChart2, Crown } from 'lucide-react'

function PwaContent() {
  const { session, loading, logout } = usePwaSession()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !session) {
      navigate('/app', { replace: true })
    }
  }, [session, loading])

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  const tabs = [
    { path: '/app/checkin', label: '掃描報到', icon: QrCode },
    { path: '/app/checkin/stats', label: '即時統計', icon: BarChart2 },
    { path: '/app/checkin/vip', label: 'VIP 名單', icon: Crown },
  ]

  const currentTab = tabs.slice().reverse().find(t => location.pathname.startsWith(t.path))?.path || tabs[0].path

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* 頂部資訊列 */}
      <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm leading-tight">{session.eventName}</p>
          <p className="text-primary-200 text-xs">{session.sessionName}</p>
        </div>
        <button
          onClick={() => { if (confirm('確定登出？')) logout() }}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          登出
        </button>
      </div>

      {/* 頁面內容 */}
      <div className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </div>

      {/* 底部導覽列 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 flex z-30">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = currentTab === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{label}</span>
              {active && <span className="absolute bottom-0 w-12 h-0.5 bg-primary-600 rounded-t-full" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PwaLayout() {
  return (
    <PwaSessionProvider>
      <PwaContent />
    </PwaSessionProvider>
  )
}
