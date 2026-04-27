import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, ChevronLeft, Search, Upload, Download,
  QrCode, Trash2, Users, FileDown, X,
  CheckSquare, Square, Filter, Pencil, Crown
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateQRToken, generateQRCodeDataURL } from '../../lib/qrcode'
import { parseRegistrantsFromExcel, exportRegistrantsToExcel, downloadImportTemplate } from '../../lib/excel'
import toast from 'react-hot-toast'
import JSZip from 'jszip'

const STANDARD_COLS = {
  '姓名': 'name', 'name': 'name', '中文姓名': 'name', '英文姓名': 'name',
  '姓名（必填）': 'name', '報名人姓名': 'name',
  '手機': 'phone', 'phone': 'phone', '電話': 'phone', '聯絡電話': 'phone',
  '手機號碼': 'phone', '行動電話': 'phone', '聯絡手機': 'phone',
  'Email': 'email', 'email': 'email', '電子郵件': 'email', 'e-mail': 'email',
  'E-mail': 'email', 'EMAIL': 'email', '信箱': 'email',
  '備註': 'notes', 'notes': 'notes', '备注': 'notes', '附註': 'notes', '備注': 'notes',
  '報名編號': 'serial_no', 'serial_no': 'serial_no', '編號': 'serial_no', '序號': 'serial_no',
  '報到狀態': null, '報到': null,
}

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
      {eventFields.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-3">以下為此活動的自訂欄位</p>
          {eventFields.map(field => (
            <div key={field.id} className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.name}{field.required && <span className="text-red-500"> *</span>}
              </label>
              {field.field_type === 'select' ? (
                <select className="input" value={customValues[field.id] || ''}
                  onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}>
                  <option value="">請選擇...</option>
                  {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input className="input" type={field.field_type === 'number' ? 'number' : 'text'}
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
          {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
          {loading ? '處理中...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function AddRegistrantModal({ eventId, eventFields, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [customValues, setCustomValues] = useState({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('請輸入姓名'); return }
    setLoading(true)
    try {
      const { count } = await supabase.from('registrants').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
      const serial_no = String((count || 0) + 1).padStart(4, '0')
      const tempId = crypto.randomUUID()
      const qr_token = await generateQRToken(tempId)
      const { data, error } = await supabase.from('registrants').insert([{
        event_id: eventId, serial_no, qr_token,
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), notes: form.notes.trim(),
      }]).select().single()
      if (error) throw error
      const fieldValues = Object.entries(customValues).filter(([, val]) => val?.trim())
        .map(([fieldId, val]) => ({ registrant_id: data.id, field_id: fieldId, value: val.trim() }))
      if (fieldValues.length > 0) await supabase.from('registrant_field_values').insert(fieldValues)
      toast.success('已新增報名者')
      onSave()
    } catch (err) {
      toast.error('新增失敗：' + err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">手動新增報名者</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <RegistrantForm form={form} setForm={setForm} customValues={customValues} setCustomValues={setCustomValues}
          eventFields={eventFields} loading={loading} onSubmit={handleSubmit} onClose={onClose} submitLabel="新增" />
      </div>
    </div>
  )
}

function EditRegistrantModal({ registrant, eventFields, onClose, onSave }) {
  const [form, setForm] = useState({
    name: registrant.name || '', phone: registrant.phone || '',
    email: registrant.email || '', notes: registrant.notes || '',
  })
  const [customValues, setCustomValues] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      if (eventFields.length === 0) return
      const { data } = await supabase.from('registrant_field_values').select('field_id, value').eq('registrant_id', registrant.id)
      if (data) { const map = {}; data.forEach(fv => { map[fv.field_id] = fv.value }); setCustomValues(map) }
    }
    load()
  }, [registrant.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('請輸入姓名'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('registrants').update({
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), notes: form.notes.trim(),
      }).eq('id', registrant.id)
      if (error) throw error
      for (const field of eventFields) {
        const val = customValues[field.id]?.trim() || ''
        if (val) {
          await supabase.from('registrant_field_values').upsert(
            { registrant_id: registrant.id, field_id: field.id, value: val }, { onConflict: 'registrant_id,field_id' })
        } else {
          await supabase.from('registrant_field_values').delete().eq('registrant_id', registrant.id).eq('field_id', field.id)
        }
      }
      toast.success('已更新報名者資料')
      onSave()
    } catch (err) {
      toast.error('更新失敗：' + err.message)
    } finally { setLoading(false) }
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
        <RegistrantForm form={form} setForm={setForm} customValues={customValues} setCustomValues={setCustomValues}
          eventFields={eventFields} loading={loading} onSubmit={handleSubmit} onClose={onClose} submitLabel="儲存變更" />
      </div>
    </div>
  )
}

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
    try { return new Set(JSON.parse(localStorage.getItem('qr_dl_' + eventId) || '[]')) } catch { return new Set() }
  })
  const [filterUndownloaded, setFilterUndownloaded] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => { fetchData() }, [eventId])

  async function fetchData() {
    setLoading(true)
    const [eventRes, regRes, fieldsRes] = await Promise.all([
      supabase.from('events').select('name').eq('id', eventId).single(),
      supabase.from('registrants').select('id, serial_no, name, phone, email, notes, qr_token, is_vip, created_at, checkins(count)').eq('event_id', eventId).order('serial_no'),
      supabase.from('event_fields').select('*').eq('event_id', eventId).order('sort_order'),
    ])
    if (eventRes.data) setEvent(eventRes.data)
    setRegistrants(regRes.data || [])
    setEventFields(fieldsRes.data || [])
    setLoading(false)
  }

  function saveDownloadedIds(newSet) {
    setDownloadedIds(new Set(newSet))
    localStorage.setItem('qr_dl_' + eventId, JSON.stringify([...newSet]))
  }

  function getFilteredList() {
    let list = registrants
    if (search) list = list.filter(r => r.name?.includes(search) || r.serial_no?.includes(search) || r.phone?.includes(search) || r.email?.includes(search))
    if (filterUndownloaded) list = list.filter(r => !downloadedIds.has(r.id))
    return list
  }

  function toggleSelectAll() {
    const displayList = getFilteredList()
    if (displayList.every(r => selectedIds.has(r.id)) && displayList.length > 0) {
      const next = new Set(selectedIds); displayList.forEach(r => next.delete(r.id)); setSelectedIds(next)
    } else {
      const next = new Set(selectedIds); displayList.forEach(r => next.add(r.id)); setSelectedIds(next)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const rows = await parseRegistrantsFromExcel(file)
      if (rows.length === 0) { toast.error('Excel 無資料'); return }
      const allKeys = Object.keys(rows[0] || {})
      // 建立欄位別名反查表（只對應有值的 STANDARD_COLS，null 表示忽略該欄）
      const colMap = {}
      allKeys.forEach(k => { if (STANDARD_COLS[k]) colMap[STANDARD_COLS[k]] = k })
      if (!colMap['name']) {
        toast.error('找不到姓名欄位，請確認 Excel 欄位名稱。目前欄位：' + allKeys.slice(0, 5).join('、'), { duration: 8000 })
        return
      }
      // 非標準欄位（且不在 STANDARD_COLS 中）建立為自訂欄位
      const customColNames = allKeys.filter(k => !(k in STANDARD_COLS))
      let currentFields = [...eventFields]
      for (const colName of customColNames) {
        if (!currentFields.find(f => f.name === colName)) {
          const { data: newField } = await supabase.from('event_fields').insert([{
            event_id: eventId, name: colName, field_type: 'text', sort_order: currentFields.length,
          }]).select().single()
          if (newField) currentFields.push(newField)
        }
      }
      const { data: existing } = await supabase.from('registrants').select('id, serial_no, qr_token').eq('event_id', eventId)
      const existingMap = {}
      ;(existing || []).forEach(r => { existingMap[r.serial_no] = r })
      let updated = 0, inserted = 0, failed = 0
      const toastId = toast.loading('覆蓋匯入中（0/' + rows.length + '）...')
      const fieldValuesBatch = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const name = String(row[colMap['name']] || '').trim()
        if (!name) continue
        const serial_no = String(i + 1).padStart(4, '0')
        const phone = String(row[colMap['phone']] || '').trim()
        const email = String(row[colMap['email']] || '').trim()
        const notes = String(row[colMap['notes']] || '').trim()
        let registrantId
        if (existingMap[serial_no]) {
          const { error } = await supabase.from('registrants').update({ name, phone, email, notes }).eq('id', existingMap[serial_no].id)
          if (!error) { registrantId = existingMap[serial_no].id; updated++ }
          else { failed++; console.error('update error row', i, error) }
        } else {
          const tempId = crypto.randomUUID()
          const qr_token = await generateQRToken(tempId)
          const { data: newR, error } = await supabase.from('registrants').insert([{
            event_id: eventId, serial_no, qr_token, name, phone, email, notes,
          }]).select('id').single()
          if (!error && newR) { registrantId = newR.id; inserted++ }
          else { failed++; console.error('insert error row', i, error) }
        }
        if (registrantId) {
          for (const field of currentFields) {
            const val = String(row[field.name] || '').trim()
            if (val) fieldValuesBatch.push({ registrant_id: registrantId, field_id: field.id, value: val })
          }
        }
        if ((i + 1) % 20 === 0) toast.loading('覆蓋匯入中（' + (i + 1) + '/' + rows.length + '）...', { id: toastId })
      }
      // 批次寫入自訂欄位值（每次最多100筆）
      for (let c = 0; c < fieldValuesBatch.length; c += 100) {
        await supabase.from('registrant_field_values').upsert(
          fieldValuesBatch.slice(c, c + 100), { onConflict: 'registrant_id,field_id' })
      }
      const failMsg = failed > 0 ? ('，失敗 ' + failed + ' 筆') : ''
      toast.success('匯入完成：更新 ' + updated + ' 人、新增 ' + inserted + ' 人' + failMsg, { id: toastId, duration: 6000 })
      fetchData()
    } catch (err) {
      toast.error('匯入失敗：' + err.message)
    } finally { setImporting(false); e.target.value = '' }
  }

  async function downloadQRCodes(targets) {
    if (targets.length === 0) { toast.error('沒有可下載的報名者'); return }
    setGeneratingQR(true)
    const toastId = toast.loading('產生 QR Code 中...')
    try {
      const zip = new JSZip()
      for (let i = 0; i < targets.length; i++) {
        const r = targets[i]
        const dataUrl = await generateQRCodeDataURL(r.qr_token)
        const safeName = (r.serial_no + '_' + r.name).replace(/[\/\\:*?"<>|\r\n]/g, '_')
        zip.file(safeName + '.png', dataUrl.split(',')[1], { base64: true })
        if ((i + 1) % 10 === 0) toast.loading('產生 QR Code 中... (' + (i + 1) + '/' + targets.length + ')', { id: toastId })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = (event?.name || '活動') + '_QRCode.zip'; a.click()
      URL.revokeObjectURL(url)
      const newSet = new Set(downloadedIds); targets.forEach(r => newSet.add(r.id)); saveDownloadedIds(newSet)
      toast.success('已下載 ' + targets.length + ' 個 QR Code', { id: toastId })
      setSelectedIds(new Set())
    } catch (err) {
      toast.error('下載失敗：' + err.message, { id: toastId })
    } finally { setGeneratingQR(false) }
  }

  async function handleDelete(r) {
    if (!confirm('確定刪除「' + r.name + '」？此操作無法復原。')) return
    const { error } = await supabase.from('registrants').delete().eq('id', r.id)
    if (error) { toast.error('刪除失敗'); return }
    toast.success('已刪除')
    const newSet = new Set(downloadedIds); newSet.delete(r.id); saveDownloadedIds(newSet)
    fetchData()
  }

  async function handleToggleVip(r) {
    const newVal = !r.is_vip
    // 樂觀更新：先改本地狀態，不等 API
    setRegistrants(prev => prev.map(reg => reg.id === r.id ? { ...reg, is_vip: newVal } : reg))
    const { error } = await supabase
      .from('registrants')
      .update({ is_vip: newVal })
      .eq('id', r.id)
    if (error) {
      toast.error('操作失敗：' + error.message)
      // 失敗時還原
      setRegistrants(prev => prev.map(reg => reg.id === r.id ? { ...reg, is_vip: !newVal } : reg))
      return
    }
    toast.success(newVal ? '⭐ 已設為 VIP 貴賓' : '已取消 VIP')
  }

  const filtered = getFilteredList()
  const allSelected = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id))
  const selectedInFiltered = filtered.filter(r => selectedIds.has(r.id)).length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">報名者管理</h1>
          <p className="text-sm text-gray-500">共 {registrants.length} 位報名者{downloadedIds.size > 0 && '・已下載 QR ' + downloadedIds.size + ' 人'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> 手動新增</button>
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload size={15} /> {importing ? '匯入中...' : 'Excel 匯入（覆蓋）'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        <button className="btn-secondary" onClick={downloadImportTemplate}><FileDown size={15} /> 下載範本</button>
        <button className="btn-secondary" onClick={() => exportRegistrantsToExcel(registrants, event?.name, eventFields)} disabled={registrants.length === 0}>
          <Download size={15} /> 匯出 Excel
        </button>
        {selectedIds.size > 0 ? (
          <button className="btn-primary" onClick={() => downloadQRCodes(registrants.filter(r => selectedIds.has(r.id)))} disabled={generatingQR}>
            <QrCode size={15} /> {generatingQR ? '產生中...' : '下載已勾選 QR（' + selectedIds.size + ' 人）'}
          </button>
        ) : (
          <button className="btn-secondary" onClick={() => downloadQRCodes(filtered)} disabled={generatingQR || filtered.length === 0}>
            <QrCode size={15} /> {generatingQR ? '產生中...' : '批次下載 QR（' + filtered.length + ' 人）'}
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-700">
        💡 <strong>Excel 匯入為覆蓋模式</strong>：依序號位置更新資料，QR Code 不會變動；序號不存在則自動新增。
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="搜尋姓名、編號、手機..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className={'btn-secondary flex items-center gap-1.5 whitespace-nowrap ' + (filterUndownloaded ? 'bg-amber-50 border-amber-300 text-amber-700' : '')}
          onClick={() => setFilterUndownloaded(p => !p)}>
          <Filter size={14} /> {filterUndownloaded ? '顯示全部' : '未下載 QR'}
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-2.5 text-sm text-primary-700 flex items-center justify-between">
          <span>已勾選 <strong>{selectedIds.size}</strong> 位{selectedInFiltered !== selectedIds.size && '（本頁 ' + selectedInFiltered + ' 位）'}</span>
          <button className="text-primary-500 hover:text-primary-700 text-xs underline" onClick={() => setSelectedIds(new Set())}>取消全選</button>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search || filterUndownloaded ? '找不到符合的報名者' : '尚無報名者，請匯入或手動新增'}</p>
          {filterUndownloaded && !search && <p className="text-xs mt-2 text-green-600">🎉 所有報名者的 QR Code 都已下載完畢！</p>}
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                    {allSelected ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
                  </button>
                </th>
                <th>編號</th><th>姓名</th>
                <th className="hidden sm:table-cell">手機</th>
                <th className="hidden md:table-cell">Email</th>
                <th>VIP</th><th>報到</th><th>QR</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const checkedIn = (r.checkins?.[0]?.count || 0) > 0
                const qrDownloaded = downloadedIds.has(r.id)
                const isSelected = selectedIds.has(r.id)
                return (
                  <tr key={r.id} className={isSelected ? 'bg-primary-50' : r.is_vip ? 'bg-amber-50' : ''}>
                    <td>
                      <button onClick={() => toggleSelect(r.id)} className="text-gray-400 hover:text-primary-600">
                        {isSelected ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="font-mono text-xs text-gray-500">{r.serial_no}</td>
                    <td className="font-medium">
                      {r.name}
                      {r.notes && <span className="ml-1.5 text-xs text-gray-400 cursor-help" title={'備註：' + r.notes}>✏️</span>}
                    </td>
                    <td className="hidden sm:table-cell text-gray-500 text-xs">{r.phone || '-'}</td>
                    <td className="hidden md:table-cell text-gray-500 text-xs truncate max-w-xs">{r.email || '-'}</td>
                    <td>
                      <button
                        onClick={() => handleToggleVip(r)}
                        title={r.is_vip ? '取消 VIP' : '設為 VIP'}
                        className={`p-1 rounded-full transition-colors ${r.is_vip ? 'text-amber-500 hover:text-amber-300' : 'text-gray-200 hover:text-amber-400'}`}
                      >
                        <Crown size={15} />
                      </button>
                    </td>
                    <td><span className={'badge ' + (checkedIn ? 'badge-green' : 'badge-gray')}>{checkedIn ? '已報到' : '未報到'}</span></td>
                    <td>{qrDownloaded ? <span className="text-xs text-green-600 font-medium">✓ 已載</span> : <span className="text-xs text-gray-300">未載</span>}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500" onClick={() => setEditTarget(r)} title="編輯資料"><Pencil size={14} /></button>
                        <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => handleDelete(r)} title="刪除"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddRegistrantModal eventId={eventId} eventFields={eventFields} onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); fetchData() }} />}
      {editTarget && <EditRegistrantModal registrant={editTarget} eventFields={eventFields} onClose={() => setEditTarget(null)} onSave={() => { setEditTarget(null); fetchData() }} />}
    </div>
  )
}