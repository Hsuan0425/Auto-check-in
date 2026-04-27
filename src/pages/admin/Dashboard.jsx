import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Users, CheckSquare, TrendingUp, ArrowRight, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-gray-200 rounded animate-pulse mt-0.5" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ events: 0, registrants: 0, checkins: 0 })
  const [recentEvents, setRecentEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const [eventsRes, registrantsRes, checkinsRes, recentRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('registrants').select('id', { count: 'exact', head: true }),
        supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('is_cancelled', false),
        supabase.from('events').select('id, name, date, status').order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        events: eventsRes.count || 0,
        registrants: registrantsRes.count || 0,
        checkins: checkinsRes.count || 0,
      })
      setRecentEvents(recentRes.data || [])
    } catch (err) {
      toast.error('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const checkInRate = stats.registrants > 0
    ? Math.round((stats.checkins / stats.registrants) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">總覽</h1>
          <p className="text-sm text-gray-500 mt-0.5">歡迎回來，以下是系統概況</p>
        </div>
        <button
          onClick={() => navigate('/admin/events')}
          className="btn-primary"
        >
          <Plus size={16} />
          新增活動
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="進行中活動"
          value={stats.events}
          color="bg-primary-500"
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="報名總人數"
          value={stats.registrants.toLocaleString()}
          color="bg-blue-500"
          loading={loading}
        />
        <StatCard
          icon={CheckSquare}
          label="已報到人數"
          value={stats.checkins.toLocaleString()}
          color="bg-green-500"
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="整體報到率"
          value={`${checkInRate}%`}
          color="bg-orange-500"
          loading={loading}
        />
      </div>

      {/* 近期活動 */}
      <div className="card">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">近期活動</h2>
          <button
            onClick={() => navigate('/admin/events')}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>尚無活動，點選右上角新增第一個活動</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentEvents.map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/admin/events/${event.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Calendar size={15} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{event.name}</p>
                    <p className="text-xs text-gray-400">
                      {event.date
                        ? new Date(event.date).toLocaleDateString('zh-TW')
                        : '未設定日期'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${event.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                    {event.status === 'active' ? '進行中' : '已結束'}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/admin/events')}
          className="card p-5 text-left hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <Calendar size={24} className="text-primary-600 mb-3" />
          <p className="font-semibold text-gray-900 group-hover:text-primary-700">管理活動</p>
          <p className="text-sm text-gray-500 mt-1">新增、編輯、管理活動場次</p>
        </button>

        <div className="card p-5 bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100">
          <CheckSquare size={24} className="text-primary-600 mb-3" />
          <p className="font-semibold text-gray-900">開始報到</p>
          <p className="text-sm text-gray-500 mt-1">在手機瀏覽器開啟 /app 路徑</p>
        </div>

        <div className="card p-5">
          <TrendingUp size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900">報到分析</p>
          <p className="text-sm text-gray-500 mt-1">進入各活動查看峰值時段分析</p>
        </div>
      </div>
    </div>
  )
}
