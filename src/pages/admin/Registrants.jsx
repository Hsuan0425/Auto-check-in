import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, ChevronLeft, Search, Upload, Download,
  QrCode, Trash2, Users, FileDown, X,
  CheckSquare, Square, Filter, Pencil
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateQRToken, generateQRCodeDataURL } from '../../lib/qrcode'
import { parseRegistrantsFromExcel, exportRegistrantsToExcel, downloadImportTemplate } from '../../lib/excel'
import toast from 'react-hot-toast'
import JSZip from 'jszip'

// 標準欄位對應表（Excel 欄名 → DB 欄位）
const STANDARD_COLS = {
  '姓名': 'name', 'name': 'name',
  '手機': 'phone', 'phone': 'phone', '電話': 'phone', '聯絡電話': 'phone',
  'Email': 'email', 'email': 'email', '電子郵件': 'email', 'e-mail': 'email',
  '備註': 'notes', 'notes': 'notes', '備注': 'notes', '附註': 'notes',
  '報名編號': 'serial_no', 'serial_no': 'serial_no', '編號': 'serial_no',
  '序號': 'serial_no',
}

// ─── 共用表單欄位元件 ─────────────────────────────────────
function RegistrantForm({ form, setForm, customValues, setCustomValues, eventFields, loading, onSubmit, onClose, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
        <input className="input" placeholder="請輸入姓名" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">手機</label>
        <input className="input" placeholder="09xxxxxxxx" value={form.phone}
          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" className="input" placeholder="name@example.com" value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      </div>

      {/* 自訂欄位（從 Excel 匯入後自動建立） */}
      {eventFields.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-3">以下為此活動的自訂欄位</p>
          {eventFields.map(field => (
            <div key={field.id} className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.name}{field.required && <span className="text-red-500"> *</span>}
              </label>
              {field.field_type === 'select' ? (
                <select className="input"
                  value={customValues[field.id] || ''}
                  onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}>
                  <option value="">請選擇...</option>
                  {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input className="input"
                  type={field.field_type === 'number' ? 'number' : 'text'}
                  value={customValues[field.id] || ''}
                  onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required} />
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
        <input className="input" placeholder="備註說明" value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">取消</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : null}
          {loading ? '處理中...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// ─── 手動新增 Modal ───────────────────────────────────────
function AddRegistrantModal({ eventId, eventFields, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [customValues, setCustomValues] = useState({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('請輸入姓名'); return }
    setLoading(true)
    try {
      const { count } = await supabase
        .from('registrants').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
      const serial_no = String((count || 0) + 1).padStart(4, '0')
      const tempId = crypto.randomUUID()
      const qr_token = await generateQRToken(tempId)

      const { data, error } = await supabase.from('registrants').insert([{
        event_id: eventId, serial_no, qr_token,
        name: form.name.trim(), phone: form.phone.trim(),
        email: form.email.trim(), notes: form.notes.trim(),
      }]).select().single()
      if (error) throw error

      const fieldValues = Object.entries(customValues)
        .filter(([, val]) => val?.trim())
        .map(([fieldId, val]) => ({ registrant_id: data.id, field_id: fieldId, value: val.trim() }))
      if (fieldValues.length > 0) await supabase.from('registrant_field_values').insert(fieldValues)

      toast.success('已新增報名者')
      onSave()
    } catch (err) {
      toast.error('新增失敗：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">手動新增報名者</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <RegistrantForm
          form={form} setForm={setForm}
          customValues={customValues} setCustomValues={setCustomValues}
          eventFields={eventFields} loading={loading}
          onSubmit={handleSubmit} onClose={onClose} submitLabel="新增" />
      </div>
    </div>
  )
}

// ─── 編輯 Modal ───────────────────────────────────────────
function EditRegistrantModal({ registrant, eventFields, onClose, onSave }) {
  const [form, setForm] = useState({
    name: registrant.name || '',
    phone: registrant.phone || '',
    email: registrant.email || '',
    notes: registrant.notes || '',
  })
  const [customValues, setCustomValues] = useState({})
  const [loading, setLoading] = useState(false)

  // 載入現有自訂欄位值
  useEffect(() => {
    async function load() {
      if (eventFields.length === 0) return
      const { data } = await supabase
        .from('registrant_field_values').select('field_id, value')
        .eq('registrant_id', registrant.id)
      if (data) {
        const map = {}
        data.forEach(fv => { map[fv.field_id] = fv.value })
        setCustomValues(map)
      }
    }
    load()
  }, [registrant.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('請輸入姓名'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('registrants').update({
        name: form.name.trim(), phone: form.phone.trim(),
        email: form.email.trim(), notes: form.notes.trim(),
      }).eq('id', registrant.id)
      if (error) throw error

      // 更新自訂欄位值（upsert）
      for (const field of eventFields) {
        const val = customValues[field.id]?.trim() || ''
        if (val) {
          await supabase.from('registrant_field_values').upsert(
            { registrant_id: registrant.id, field_id: field.id, value: val },
            { onConflict: 'registrant_id,field_id' }
          )
        } else {
          await supabase.from('registrant_field_values')
            .delete().eq('registrant_id', registrant.id).eq('field_id', field.id)
        }
      }

      toast.success('已更新報名者資料')
      onSave()
    } catch (err) {
      toast.error('更新失敗：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">編輯報名者</h2>
            <p className="text-xs text-gray-400 mt-0.5">編號 {registrant.serial_no}・QR Code 不會變動</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <RegistrantForm
          form={form} setForm={setForm}
          customValues={customValues} setCustomValues={setCustomValues}
          eventFields={eventFields} loading={loading}
          onSubmit={handleSubmit} onClose={onClose} submitLabel="儲存變更" />
      </div>
    </div>
  )
}

// ─── 主頁面 ──────────────────────────────────────────────
export default function Registrants() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [registrants, setRegistrants] = useState([])
  const [eventFields, setEventFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [importing, setImporting] = useState(false)
  const [generatingQR, setGeneratingQR] = useState(false)

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [downloadedIds, setDownloadedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`qr_dl_${eventId}`)
      return new Set(JSON.parse(saved) || [])
    } catch { return new Set() }
  })
  const [filterUndownloaded, setFilterUndownloaded] = useState(false)

  const fileInputRef = useRef()

  useEffect(() => { fetchData() }, [eventId])

  async function fetchData() {
    setLoading(true)
    const [eventRes, regRes, fieldsRes] = await Promise.all([
      supabase.from('events').select('name').eq('id', eventId).single(),
      supabase.from('registrants').select(`
        id, serial_no, name, phone, email, notes, qr_token, created_at,
        checkins(count)
      `).eq('event_id', eventId).order('serial_no'),
      supabase.from('event_fields').select('*').eq('event_id', eventId).order('sort_order'),
    ])
    if (eventRes.data) setEvent(eventRes.data)
    setRegistrants(regRes.data || [])
    setEventFields(fieldsRes.data || [])
    setLoading(false)
  }

  function saveDownloadedIds(newSet) {
    setDownloadedIds(new Set(newSet))
    localStorage.setItem(`qr_dl_${eventId}`, JSON.stringify([...newSet]))
  }

  function getFilteredList() {
    let list = registrants
    if (search) {
      list = list.filter(r =>
        r.name?.includes(search) || r.serial_no?.includes(search) ||
        r.phone?.includes(search) || r.email?.includes(search)
      )
    }
    if (filterUndownloaded) list = list.filter(r => !downloadedIds.has(r.id))
    return list