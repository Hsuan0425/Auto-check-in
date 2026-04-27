import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import { Menu, X, LogOut, Bell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
    toast.success('已登出')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 手機側邊欄遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 側邊欄 */}
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 主區域 */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* 頂部導覽列 */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sticky top-0 z-10">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
              title="登出"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </header>

        {/* 頁面內容 */}
        <main className="flex-1 p-4 md:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
