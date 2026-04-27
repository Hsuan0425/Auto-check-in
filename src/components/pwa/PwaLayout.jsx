import { Outlet, useNavigate } from 'react-router-dom'
import { PwaSessionProvider, usePwaSession } from '../../hooks/usePwaSession'
import { useEffect } from 'react'

function PwaContent() {
  const { session, loading, logout } = usePwaSession()
  const navigate = useNavigate()

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
      <div className="flex-1 overflow-y-auto">
        <Outlet />
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
