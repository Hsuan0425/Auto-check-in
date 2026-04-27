import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Users, ClipboardList, BarChart2, Settings,
  ChevronLeft, QrCode, Calendar, MapPin, Edit
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import EventFormModal from '../../components/admin/EventFormModal'

function TabCard({ icon: Icon, title, desc, to, color }) {
  return (
    <Link
      to={to}
      className="card p-5 hover:shadow-md hover:border-primary-200 transition-all group"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="font-semibold text-gray-900 group-hover:text-primary-700">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </Link>
  )
}

export default function EventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [stats, setStats] = useState({ registrants: 0, checkins: 0, sessions: 0 })
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    fetchEvent()
  }, [eventId])

  async function fetchEvent() {
    try {
      const [eventRes, regRes, sessionRes, checkinRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('registrants').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('checkins').select('id', { count: 'exact', head: true })
          .eq('is_cancelled', false)
          .in('session_id',
            (await supabase.from('sessions').select('id').eq('event_id', eventId)).data?.map(s => s.id) || []
          ),
      ])

      if (eventRes.error) throw eventRes.error
      setEvent(eventRes.data)
      setStats({
        registrants: regRes.count || 0,
        sessions: sessionRes.count || 0,
        checkins: checkinRes.count || 0,
      })
    } catch (err) {
      toast.error('載入活動失敗')
      navigate('/admin/events')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!event) return null

  const rate = stats.registrants > 0
    ? Math.round(stats.checkins / stats.registrants * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* 返回 */}
      <button
        onClick={() => navigate('/admin/events')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft size={16} /> 返回活動列表
      </button>

      {/* 活動資訊卡 */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
              <Calendar size={22} className="text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
                <span className={`badge ${event.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                  {event.status === 'active' ? '進行中' : '已結束'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-gray-500">
                {event.date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(event.date).toLocaleDateString('zh-TW')}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {event.location}
                  </span>
                )}
              </div>
              {event.notes && (
                <p className="text-sm text-gray-500 mt-2">{event.notes}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="btn-secondary shrink-0"
          >
            <Edit size={14} /> 編輯
          </button>
        </div>

        {/* 統計列 */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: '報名人數', value: stats.registrants },
            { label: '已報到', value: stats.checkins },
            { label: '報到率', value: `${rate}%` },
            { label: '報到場次', value: stats.sessions },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 功能入口 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <TabCard
          icon={Users}
          title="報名者管理"
          desc="匯入、QR Code 下載、查詢"
          to={`/admin/events/${eventId}/registrants`}
          color="bg-blue-500"
        />
        <TabCard
          icon={ClipboardList}
          title="報到記錄"
          desc="查看記錄、取消報到、匯出"
          to={`/admin/events/${eventId}/checkins`}
          color="bg-green-500"
        />
        <TabCard
          icon={BarChart2}
          title="峰值分析"
          desc="報到時段分布圖"
          to={`/admin/events/${eventId}/analytics`}
          color="bg-orange-500"
        />
        <TabCard
          icon={QrCode}
          title="報到場次"
          desc="管理報到場次與密碼"
          to={`/admin/events/${eventId}/sessions`}
          color="bg-purple-500"
        />
      </div>

      {showEdit && (
        <EventFormModal
          event={event}
          onClose={() => setShowEdit(false)}
          onSave={() => { setShowEdit(false); fetchEvent() }}
        />
      )}
    </div>
  )
}
