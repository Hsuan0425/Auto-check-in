import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, CheckSquare, TrendingUp, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePwaSession } from '../../hooks/usePwaSession'

export default function PwaStats() {
  const { session } = usePwaSession()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    fetchStats()
    // 每 30 秒自動刷新
    const timer = setInterval(fetchStats, 30000)
    return () => clearInterval(timer)
  }, [])

  async function fetchStats() {
    try {
      const [totalRes, checkinRes, recentRes] = await Promise.all([
        supabase.from('registrants').select('id', { count: 'exact', head: true }).eq('event_id', session.eventId),
        supabase.from('checkins').select('id', { count: 'exact', head: true })
          .eq('session_id', session.sessionId).eq('is_cancelled', false),
        supabase.from('checkins')
          .select('checked_at, registrants(name)')
          .eq('session_id', session.sessionId)
          .eq('is_cancelled', false)
          .order('checked_at', { ascending: false })
          .limit(10),
      ])
      setStats({
        total: totalRes.count || 0,
        checkins: checkinRes.count || 0,
        recent: recentRes.data || [],
      })
      setLastUpdated(new Date())
    } catch (err) {
      // 靜默失敗
    } finally {
      setLoading(false)
    }
  }

  const rate = stats && stats.total > 0
    ? Math.round(stats.checkins / stats.total * 100)
    : 0

  return (
    <div className="min-h-[calc(100vh-56px)] p-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">即時報到統計</h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400">
              更新於 {lastUpdated.toLocaleTimeString('zh-TW')}
            </p>
          )}
        </div>
        <button onClick={fetchStats} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <RefreshCw size={15}/>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* 統計卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <Users size={18} className="text-blue-500 mx-auto mb-1"/>
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">報名人數</p>
            </div>
            <div className="card p-4 text-center">
              <CheckSquare size={18} className="text-green-500 mx-auto mb-1"/>
              <p className="text-xl font-bold">{stats.checkins}</p>
              <p className="text-xs text-gray-500">已報到</p>
            </div>
            <div className="card p-4 text-center">
              <TrendingUp size={18} className="text-primary-600 mx-auto mb-1"/>
              <p className="text-xl font-bold">{rate}%</p>
              <p className="text-xs text-gray-500">報到率</p>
            </div>
          </div>

          {/* 進度條 */}
          <div className="card p-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>報到進度</span>
              <span>{stats.checkins} / {stats.total}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">
              尚有 {stats.total - stats.checkins} 人未報到
            </p>
          </div>

          {/* 最新報到 */}
          <div className="card">
            <div className="px-4 pt-4 pb-2 border-b border-gray-100">
              <h3 className="font-medium text-sm text-gray-900">最新報到（前 10 位）</h3>
            </div>
            {stats.recent.length === 0 ? (
              <p className="text-center text-gray-400 text-sm p-6">尚無報到記錄</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.recent.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{c.registrants?.name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(c.checked_at).toLocaleTimeString('zh-TW', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400 p-8">無法載入統計資料</div>
      )}
    </div>
  )
}
