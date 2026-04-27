import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, QrCode,
  ClipboardList, BarChart2, Settings, X, ChevronRight
} from 'lucide-react'

const navItems = [
  {
    label: '總覽',
    icon: LayoutDashboard,
    to: '/admin',
    exact: true,
  },
  {
    label: '活動管理',
    icon: Calendar,
    to: '/admin/events',
  },
]

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <item.icon size={18} />
      {item.label}
    </NavLink>
  )
}

export default function AdminSidebar({ open, onClose }) {
  return (
    <aside
      className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-30
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
    >
      {/* 品牌 */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <QrCode size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">活動報到</p>
            <p className="text-xs text-gray-400 leading-tight">管理後台</p>
          </div>
        </div>
        <button
          className="lg:hidden p-1 rounded text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* 主選單 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavItem key={item.to} item={item} onClick={onClose} />
        ))}

        <div className="pt-4 mt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 px-3 mb-2 uppercase tracking-wider">
            快速連結
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Settings size={18} />
            Supabase 後台
            <ChevronRight size={14} className="ml-auto" />
          </a>
        </div>
      </nav>

      {/* 底部版本 */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
