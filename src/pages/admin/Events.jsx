import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, Search, MoreVertical, Trash2, Edit, ArrowRight, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import EventFormModal from '../../components/admin/EventFormModal'

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [menuOpen, setMenuOpen] = useState(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, name, date, location, status, created_at,
          registrants(count),
          sessions(id, checkins(count))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      toast.error('載入活動失敗')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(event) {
    if (!confirm(`確定要刪除「${event.name}」嗎？此操作無法復原。`)) return
    try {
      const { error } = await supabase.from('events').delete().eq('id', event.id)
      if (error) throw error
      toast.success('已刪除活動')
      fetchEvents()
    } catch (err) {
      toast.error('刪除失敗：' + err.message)
    }
    setMenuOpen(null)
  }

  function handleEdit(event) {
    setEditingEvent(event)
    setShowModal(true)
    setMenuOpen(null)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditingEvent(null)
  }

  function handleModalSave() {
    handleModalClose()
    fetchEvents()
  }

  const filtered = events.filter(e =>
    e.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function getCheckinCount(event) {
    return event.sessions?.reduce((sum, s) =>
      sum + (s.checkins?.[0]?.count || 0), 0) || 0
  }

  function getRegistrantCount(event) {
    return event.registrants?.[0]?.count || 0
  }

  return (
    <div className="space-y-5">
      {/* 頁頭 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">活動管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">共 {events.length} 個活動</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          新增活動
        </button>
      </div>

      {/* 搜尋 */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="搜尋活動名稱..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 活動列表 */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card p-5 h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {searchQuery ? '找不到符合的活動' : '尚無活動'}
          </p>
          {!searchQuery && (
            <button
              className="btn-primary mt-4"
              onClick={() => setShowModal(true)}
            >
              <Plus size={16} />
              新增第一個活動
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => {
            const checkins = getCheckinCount(event)
            const registrants = getRegistrantCount(event)
            const rate = registrants > 0 ? Math.round(checkins / registrants * 100) : 0

            return (
              <div
                key={event.id}
                className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/events/${event.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                      <Calendar size={18} className="text-primary-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{event.name}</h3>
                        <span className={`badge ${event.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                          {event.status === 'active' ? '進行中' : '已結束'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-500">
                        {event.date && (
                          <span>📅 {new Date(event.date).toLocaleDateString('zh-TW')}</span>
                        )}
                        {event.location && <span>📍 {event.location}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          報名 {registrants} 人
                        </span>
                        <span>報到 {checkins} 人</span>
                        <span className="text-primary-600 font-medium">
                          報到率 {rate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 動作選單 */}
                  <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                      onClick={() => setMenuOpen(menuOpen === event.id ? null : event.id)}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === event.id && (
                      <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => handleEdit(event)}
                        >
                          <Edit size={14} /> 編輯
                        </button>
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(event)}
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 報到率進度條 */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <button
                    className="text-xs text-primary-600 hover:underline flex items-center gap-0.5"
                    onClick={e => { e.stopPropagation(); navigate(`/admin/events/${event.id}`) }}
                  >
                    查看詳情 <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新增/編輯彈窗 */}
      {showModal && (
        <EventFormModal
          event={editingEvent}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  )
}
