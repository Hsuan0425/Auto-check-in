import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Search, XCircle, RotateCcw, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { exportCheckinsToExcel } from '../../lib/excel'
import toast from 'react-hot-toast'

// 修改報到時間 Modal
function EditTimeModal({ checkin, onClose, onSave }) {
  const [value, setValue] = useState(
    checkin.checked_at ? new Date(checkin.checked_at).toISOString().slice(0, 16) : ''
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!value) { toast.error('請選擇時間'); return }
    setLoading(true)
    const { error } = await supabase
      .from('checkins')
      .update({ checked_at: new Date(value).toISOString() })
      .eq('id', checkin.id)
    setLoading(false)
    if (error) { toast.error('更新失敗'); return }
    toast.success('已更新報到時間')
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">修改報到時間</h2>
          <p className="text-sm text-gray-500 mt-1">{checkin.registrants?.name}</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <input type="datetime-local" className="input" value={value} onChange={e => setValue(e.target.value)} required/>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">取消</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CheckinRecords() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTime, setEditTime] = useState(null)

  useEffect(() => { fetchData() }, [eventId])

  async function fetchData() {
    setLoading(true)
    const [eventRes, checkinsRes] = await Promise.all([
      supabase.from('events').select('name').eq('id', eventId).single(),
      supabase.from('checkins')
        .select(`
          id, checked_at, operator_name, is_cancelled, device_id,
          registrants(name, serial_no, phone),
          sessions(name)
        `)
        .in('session_id',
          (await supabase.from('sessions').select('id').eq('event_id', eventId)).data?.map(s => s.id) || []
        )
        .order('checked_at', { ascending: false })
    ])
    if (eventRes.data) setEvent(eventRes.data)
    setCheckins(checkinsRes.data || [])
    setLoading(false)
  }

  async function handleCancel(checkin) {
    const msg = checkin.is_cancelled
      ? `確定恢復「${checkin.registrants?.name}」的報到狀態？`
      : `確定取消「${checkin.registrants?.name}」的報到記錄？`
    if (!confirm(msg)) return
    const { error } = await supabase
      .from('checkins')
      .update({ is_cancelled: !checkin.is_cancelled })
      .eq('id', checkin.id)
    if (error) { toast.error('操作失敗'); return }
    toast.success(checkin.is_cancelled ? '已恢復報到' : '已取消報到')
    fetchData()
  }

  const filtered = checkins.filter(c =>
    c.registrants?.name?.includes(search) ||
    c.registrants?.serial_no?.includes(search) ||
    c.sessions?.name?.includes(search)
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={18}/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">報到記錄</h1>
          <p className="text-sm text-gray-500">
            有效報到 {checkins.filter(c => !c.is_cancelled).length} 筆 / 共 {checkins.length} 筆
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => exportCheckinsToExcel(checkins, event?.name)}
          disabled={checkins.length === 0}
        >
          <Download size={15}/> 匯出 Excel
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9" placeholder="搜尋姓名、編號、場次..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"/>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th className="hidden sm:table-cell">場次</th>
                <th>報到時間</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-12">
                    {search ? '找不到符合記錄' : '尚無報到記錄'}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className={c.is_cancelled ? 'opacity-50' : ''}>
                  <td>
                    <p className="font-medium">{c.registrants?.name}</p>
                    <p className="text-xs text-gray-400">{c.registrants?.serial_no}</p>
                  </td>
                  <td className="hidden sm:table-cell text-gray-500 text-xs">{c.sessions?.name || '-'}</td>
                  <td className="text-sm text-gray-600">
                    {c.checked_at
                      ? new Date(c.checked_at).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
                      : '-'
                    }
                  </td>
                  <td>
                    <span className={`badge ${c.is_cancelled ? 'badge-red' : 'badge-green'}`}>
                      {c.is_cancelled ? '已取消' : '已報到'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="修改時間"
                        onClick={() => setEditTime(c)}
                      >
                        <Clock size={13}/>
                      </button>
                      <button
                        className={`p-1.5 rounded text-gray-400 hover:text-orange-500 hover:bg-orange-50`}
                        title={c.is_cancelled ? '恢復報到' : '取消報到'}
                        onClick={() => handleCancel(c)}
                      >
                        {c.is_cancelled ? <RotateCcw size={13}/> : <XCircle size={13}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTime && (
        <EditTimeModal
          checkin={editTime}
          onClose={() => setEditTime(null)}
          onSave={() => { setEditTime(null); fetchData() }}
        />
      )}
    </div>
  )
}
