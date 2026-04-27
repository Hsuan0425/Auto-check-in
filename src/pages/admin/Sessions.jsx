import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, ChevronLeft, QrCode, Trash2, Edit, Copy, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

function SessionModal({ session, eventId, onClose, onSave }) {
  const isEdit = !!session
  const [form, setForm] = useState({
    name: session?.name || '',
    password: '',
    is_active: session?.is_active ?? true,
    display_fields: session?.display_fields || [],
  })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('請輸入場次名稱'); return }
    if (!isEdit && !form.password.trim()) { toast.error('請設定場次密碼'); return }
    setLoading(true)
    try {
      if (isEdit) {
        const update = { name: form.name, is_active: form.is_active, display_fields: form.display_fields }
        if (form.password.trim()) update.password_hash = form.password  // 後端再 hash
        const { error } = await supabase.from('sessions').update(update).eq('id', session.id)
        if (error) throw error
        toast.success('場次已更新')
      } else {
        const { error } = await supabase.from('sessions').insert([{
          event_id: eventId,
          name: form.name,
          password_hash: form.password,
          is_active: form.is_active,
          display_fields: form.display_fields,
        }])
        if (error) throw error
        toast.success('場次已新增')
      }
      onSave()
    } catch (err) {
      toast.error('操作失敗：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{isEdit ? '編輯場次' : '新增報到場次'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">場次名稱 *</label>
            <input className="input" placeholder="例：入場報到" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? '場次密碼（留空不修改）' : '場次密碼 *'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                placeholder={isEdit ? '留空表示不修改密碼' : '請設定報到密碼'}
                value={form.password}
                onChange={e => setForm(p => ({...p, password: e.target.value}))}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">手機端報到人員輸入此密碼登入</p>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-primary-600 rounded"
                checked={form.is_active}
                onChange={e => setForm(p => ({...p, is_active: e.target.checked}))}
              />
              <span className="text-sm text-gray-700">場次開放中（可供手機端登入）</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">取消</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : null}
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Sessions() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editSession, setEditSession] = useState(null)

  useEffect(() => { fetchSessions() }, [eventId])

  async function fetchSessions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*, checkins(count)')
      .eq('event_id', eventId)
      .order('created_at')
    if (!error) setSessions(data || [])
    setLoading(false)
  }

  async function handleDelete(session) {
    if (!confirm(`確定刪除場次「${session.name}」？`)) return
    const { error } = await supabase.from('sessions').delete().eq('id', session.id)
    if (error) { toast.error('刪除失敗'); return }
    toast.success('已刪除')
    fetchSessions()
  }

  function copyCheckinUrl(sessionId) {
    const url = `${window.location.origin}/app?session=${sessionId}`
    navigator.clipboard.writeText(url)
    toast.success('報到連結已複製！')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">報到場次管理</h1>
          <p className="text-sm text-gray-500">建立場次並設定報到密碼供手機端使用</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditSession(null); setShowModal(true) }}>
          <Plus size={16} /> 新增場次
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100"/>)}</div>
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <QrCode size={40} className="mx-auto mb-3 opacity-30"/>
          <p>尚無場次，請新增報到場次</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {s.is_active ? '開放中' : '已關閉'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    已報到：{s.checkins?.[0]?.count || 0} 人
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary text-xs py-1.5 px-3"
                    onClick={() => copyCheckinUrl(s.id)}
                    title="複製報到連結"
                  >
                    <Copy size={13} /> 複製連結
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                    onClick={() => { setEditSession(s); setShowModal(true) }}
                  >
                    <Edit size={15}/>
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                    onClick={() => handleDelete(s)}
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SessionModal
          session={editSession}
          eventId={eventId}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchSessions() }}
        />
      )}
    </div>
  )
}
