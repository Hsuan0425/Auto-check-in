import { useEffect, useState, useRef } from 'react'
import { Users, CheckSquare, TrendingUp, RefreshCw, Search, X, CheckCircle, Clock, UserX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePwaSession } from '../../hooks/usePwaSession'

export default function PwaStats() {
  const { session } = usePwaSession()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // 人員查詢
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState(null) // null=未查 | 'searching' | {found, checkedIn, ...}
  const [queryLoading, setQueryLoading] = useState(false)
  const searchDebounce = useRef()

  useEffect(() => {
    fetchStats()
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
    } catch {}
    finally { setLoading(false) }
  }

  function handleQueryChange(val) {
    setQuery(val)
    setQueryResult(null)
    if (!val.trim()) return
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => searchPerson(val.trim()), 400)
  }

  async function searchPerson(keyword) {
    setQueryLoading(true)
    try {
      // 先找報名者（姓名或編號）
      const { data: regs } = await supabase
        .from('registrants')
        .select('id, name, serial_no, phone')
        .eq('event_id', session.eventId)
        .or(`name.ilike.%${keyword}%,serial_no.eq.${keyword}`)
        .limit(5)

      if (!regs || regs.length === 0) {
        setQueryResult({ found: false })
        return
      }

      // 查這幾人的報到狀態
      const ids = regs.map(r => r.id)
      const { data: checkins } = await supabase
        .from('checkins')
        .select('registrant_id, checked_at, operator_name, is_cancelled')
        .in('registrant_id', ids)
        .eq('session_id', session.sessionId)
        .eq('is_cancelled', false)

      const checkinMap = {}
      ;(checkins || []).forEach(c => { checkinMap[c.registrant_id] = c })

      setQueryResult({
        found: true,
        people: regs.map(r => ({
          ...r,
          checkin: checkinMap[r.id] || null,
        }))
      })
    } catch {}
    finally { setQueryLoading(false) }
  }

  const rate = stats && stats.total > 0
    ? Math.round(stats.checkins / stats.total * 100)
    : 0

  return (
    <div className="p-4 space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">即時報到統計</h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400">更新於 {lastUpdated.toLocaleTimeString('zh-TW')}</p>
          )}
        </div>
        <button onClick={fetchStats} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <RefreshCw size={15}/>
        </button>
      </div>

      {/* 人員查詢搜尋框 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">🔍 查詢報到狀況</p>
        <div className="relative">
          <input
            className="input pl-9 pr-8"
            placeholder="輸入姓名或報名編號..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          {query && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              onClick={() => { setQuery(''); setQueryResult(null) }}
            >
              <X size={15}/>
            </button>
          )}
        </div>

        {/* 查詢結果 */}
        {queryLoading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        )}
        {queryResult && !queryLoading && (
          <div className="mt-3 space-y-2">
            {!queryResult.found ? (
              <p className="text-center text-sm text-gray-400 py-2">找不到「{query}」</p>
            ) : queryResult.people.map(p => (
              <div key={p.id} className={`rounded-xl p-3 border ${p.checkin ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {p.checkin
                        ? <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>
                        : <UserX size={14} className="text-gray-400 flex-shrink-0"/>
                      }
                      <span className="font-semibold text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{p.serial_no}</span>
                    </div>
                    {p.checkin ? (
                      <div className="mt-1.5 space-y-0.5 pl-5">
                        <p className="text-xs text-green-700 flex items-center gap-1">
                          <Clock size={11}/> {new Date(p.checkin.checked_at).toLocaleString('zh-TW', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}
                        </p>
                        {p.checkin.operator_name && (
                          <p className="text-xs text-green-600">👤 {p.checkin.operator_name} 協助報到</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1 pl-5">尚未報到</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${p.checkin ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {p.checkin ? '已報到' : '未報到'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
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
