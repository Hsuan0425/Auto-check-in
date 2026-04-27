import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, TrendingUp, Clock, Users, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart
} from 'recharts'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Analytics() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeUnit, setTimeUnit] = useState('15') // 15 分鐘/30分/60分

  useEffect(() => { fetchData() }, [eventId])

  async function fetchData() {
    setLoading(true)
    const [eventRes, sessionsRes] = await Promise.all([
      supabase.from('events').select('name, date').eq('id', eventId).single(),
      supabase.from('sessions').select('id').eq('event_id', eventId),
    ])
    if (eventRes.data) setEvent(eventRes.data)

    const sessionIds = sessionsRes.data?.map(s => s.id) || []
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from('checkins')
        .select('checked_at')
        .in('session_id', sessionIds)
        .eq('is_cancelled', false)
        .not('checked_at', 'is', null)
        .order('checked_at')
      setCheckins(data || [])
    }
    setLoading(false)
  }

  // 根據時間單位分組
  function buildChartData(minutes) {
    if (checkins.length === 0) return []
    const buckets = {}
    checkins.forEach(c => {
      const d = new Date(c.checked_at)
      const totalMinutes = d.getHours() * 60 + d.getMinutes()
      const bucket = Math.floor(totalMinutes / minutes) * minutes
      const h = Math.floor(bucket / 60).toString().padStart(2, '0')
      const m = (bucket % 60).toString().padStart(2, '0')
      const key = `${h}:${m}`
      buckets[key] = (buckets[key] || 0) + 1
    })
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({ time, count }))
  }

  // 累積人數曲線
  function buildCumulativeData() {
    if (checkins.length === 0) return []
    const minutes = Number(timeUnit)
    const buckets = {}
    checkins.forEach(c => {
      const d = new Date(c.checked_at)
      const totalMinutes = d.getHours() * 60 + d.getMinutes()
      const bucket = Math.floor(totalMinutes / minutes) * minutes
      const h = Math.floor(bucket / 60).toString().padStart(2, '0')
      const m = (bucket % 60).toString().padStart(2, '0')
      const key = `${h}:${m}`
      buckets[key] = (buckets[key] || 0) + 1
    })
    let cumulative = 0
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => {
        cumulative += count
        return { time, count, cumulative }
      })
  }

  const chartData = buildChartData(Number(timeUnit))
  const cumulativeData = buildCumulativeData()
  const peakBucket = chartData.reduce((max, d) => d.count > (max?.count || 0) ? d : max, null)

  const totalCount = checkins.length
  const avgPerMinute = checkins.length > 0 && chartData.length > 0
    ? (totalCount / (chartData.length * Number(timeUnit))).toFixed(2)
    : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={18}/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">峰值時段分析</h1>
          <p className="text-sm text-gray-500">{event?.name}</p>
        </div>
        {/* 時間粒度切換 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['15', '15分'], ['30', '30分'], ['60', '1時']].map(([val, label]) => (
            <button
              key={val}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeUnit === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setTimeUnit(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <Users size={18} className="text-primary-600 mx-auto mb-1"/>
          <p className="text-xl font-bold">{totalCount}</p>
          <p className="text-xs text-gray-500">已報到人數</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp size={18} className="text-orange-500 mx-auto mb-1"/>
          <p className="text-xl font-bold">{peakBucket?.count || 0}</p>
          <p className="text-xs text-gray-500">單段峰值</p>
        </div>
        <div className="card p-4 text-center">
          <Clock size={18} className="text-green-500 mx-auto mb-1"/>
          <p className="text-xl font-bold">{peakBucket?.time || '-'}</p>
          <p className="text-xs text-gray-500">峰值時段</p>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"/>
        </div>
      ) : checkins.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30"/>
          <p>尚無報到資料</p>
        </div>
      ) : (
        <>
          {/* 時段分布直方圖 */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">報到人數時段分布</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd"/>
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false}/>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(v) => [`${v} 人`, '報到人數']}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[3, 3, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 累積報到人數曲線 */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">累積報到人數</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cumulativeData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd"/>
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false}/>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(v) => [`${v} 人`, '累積人數']}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#4f46e5" fill="#eef2ff" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 詳細數據表格 */}
          <div className="card">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">詳細時段資料</h3>
            </div>
            <div className="table-container rounded-none rounded-b-xl border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>時段</th>
                    <th>報到人數</th>
                    <th>累積人數</th>
                    <th>佔比</th>
                  </tr>
                </thead>
                <tbody>
                  {cumulativeData.map(d => (
                    <tr key={d.time}>
                      <td className="font-mono text-sm">{d.time}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 bg-primary-500 rounded-full"
                            style={{ width: `${Math.round(d.count / (peakBucket?.count || 1) * 80)}px` }}
                          />
                          {d.count} 人
                        </div>
                      </td>
                      <td className="text-gray-500">{d.cumulative} 人</td>
                      <td className="text-gray-500">
                        {totalCount > 0 ? Math.round(d.count / totalCount * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
