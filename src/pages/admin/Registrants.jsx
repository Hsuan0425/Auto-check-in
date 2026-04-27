import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, ChevronLeft, Search, Upload, Download,
  QrCode, Trash2, Users, FileDown, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateQRToken, generateQRCodeDataURL } from '../../lib/qrcode'
import { parseRegistrantsFromExcel, exportRegistrantsToExcel, downloadImportTemplate } from '../../lib/excel'
import toast from 'react-hot-toast'
import JSZip from 'jszip'

// 新增報名者表單
function AddRegistrantModal({ eventId, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('請輸入姓名'); return }
    setLoading(true)
    try {
      // 取得最新序號
      const { count } = await supabase
        .from('registrants').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
      const serial_no = String((count || 0) + 1).padStart(4, '0')

      // 產生 QR Token
      const tempId = crypto.randomUUID()
      const qr_token = await generateQRToken(tempId)

      const { data, error } = await supabase.from('registrants').insert([{
        event_id: eventId, serial_no, qr_token,
        name: form.name, phone: form.phone, email: form.email,
      }]).select().single()
      if (error) throw error
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
            <input className="input" placeholder="請輸入姓名" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">手機</label>
            <input className="input" placeholder="09xxxxxxxx" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input" placeholder="name@example.com" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))}/>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">取消</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Plus size={15}/>}
              {loading ? '新增中...' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Registrants() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [registrants, setRegistrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [importing, setImporting] = useState(false)
  const [generatingQR, setGeneratingQR] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => { fetchData() }, [eventId])

  async function fetchData() {
    setLoading(true)
    const [eventRes, regRes] = await Promise.all([
      supabase.from('events').select('name').eq('id', eventId).single(),
      supabase.from('registrants').select(`
        id, serial_no, name, phone, email, qr_token, created_at,
        checkins(count)
      `).eq('event_id', eventId).order('serial_no'),
    ])
    if (eventRes.data) setEvent(eventRes.data)
    setRegistrants(regRes.data || [])
    setLoading(false)
  }

  // Excel 批次匯入
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const rows = await parseRegistrantsFromExcel(file)
      if (rows.length === 0) { toast.error('Excel 無資料'); return }

      // 取得目前報名總數（用來計算序號）
      const { count: currentCount } = await supabase
        .from('registrants').select('id', { count: 'exact', head: true }).eq('event_id', eventId)

      const insertData = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const name = row['姓名'] || row['name'] || ''
        if (!name.trim()) continue
        const serial_no = String((currentCount || 0) + insertData.length + 1).padStart(4, '0')
        const tempId = crypto.randomUUID()
        const qr_token = await generateQRToken(tempId)
        insertData.push({
          event_id: eventId,
          serial_no,
          name: name.trim(),
          phone: String(row['手機'] || row['phone'] || '').trim(),
          email: String(row['Email'] || row['email'] || '').trim(),
          qr_token,
        })
      }

      const { error } = await supabase.from('registrants').insert(insertData)
      if (error) throw error
      toast.success(`成功匯入 ${insertData.length} 位報名者`)
      fetchData()
    } catch (err) {
      toast.error('匯入失敗：' + err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  // 批次產生並下載所有 QR Code（ZIP）
  async function handleBatchDownloadQR() {
    if (registrants.length === 0) { toast.error('沒有報名者'); return }
    setGeneratingQR(true)
    const toastId = toast.loading(`產生 QR Code 中... (0/${registrants.length})`)
    try {
      const zip = new JSZip()
      for (let i = 0; i < registrants.length; i++) {
        const r = registrants[i]
        const dataUrl = await generateQRCodeDataURL(r.qr_token)
        const base64 = dataUrl.split(',')[1]
        zip.file(`${r.serial_no}_${r.name}.png`, base64, { base64: true })
        if ((i + 1) % 10 === 0) {
          toast.loading(`產生 QR Code 中... (${i+1}/${registrants.length})`, { id: toastId })
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${event?.name || '活動'}_QRCode.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已下載 ${registrants.length} 個 QR Code`, { id: toastId })
    } catch (err) {
      toast.error('下載失敗：' + err.message, { id: toastId })
    } finally {
      setGeneratingQR(false)
    }
  }

  async function handleDelete(r) {
    if (!confirm(`確定刪除「${r.name}」？`)) return
    const { error } = await supabase.from('registrants').delete().eq('id', r.id)
    if (error) { toast.error('刪除失敗'); return }
    toast.success('已刪除')
    fetchData()
  }

  const filtered = registrants.filter(r =>
    r.name?.includes(search) || r.serial_no?.includes(search) ||
    r.phone?.includes(search) || r.email?.includes(search)
  )

  return (
    <div className="space-y-5">
      {/* 頁頭 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">報名者管理</h1>
          <p className="text-sm text-gray-500">共 {registrants.length} 位報名者</p>
        </div>
      </div>

      {/* 工具列 */}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15}/> 手動新增
        </button>
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload size={15}/> {importing ? '匯入中...' : 'Excel 匯入'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport}/>
        <button className="btn-secondary" onClick={downloadImportTemplate}>
          <FileDown size={15}/> 下載範本
        </button>
        <button className="btn-secondary" onClick={() => exportRegistrantsToExcel(registrants, event?.name)} disabled={registrants.length === 0}>
          <Download size={15}/> 匯出 Excel
        </button>
        <button className="btn-secondary" onClick={handleBatchDownloadQR} disabled={generatingQR || registrants.length === 0}>
          <QrCode size={15}/> {generatingQR ? '產生中...' : '批次下載 QR Code'}
        </button>
      </div>

      {/* 搜尋 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9" placeholder="搜尋姓名、編號、手機..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* 表格 */}
      {loading ? (
        <div className="card p-8 text-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"/></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30"/>
          <p>{search ? '找不到符合的報名者' : '尚無報名者，請匯入或手動新增'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>編號</th>
                <th>姓名</th>
                <th className="hidden sm:table-cell">手機</th>
                <th className="hidden md:table-cell">Email</th>
                <th>報到狀態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const checkedIn = (r.checkins?.[0]?.count || 0) > 0
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-gray-500">{r.serial_no}</td>
                    <td className="font-medium">{r.name}</td>
                    <td className="hidden sm:table-cell text-gray-500 text-xs">{r.phone || '-'}</td>
                    <td className="hidden md:table-cell text-gray-500 text-xs truncate max-w-xs">{r.email || '-'}</td>
                    <td>
                      <span className={`badge ${checkedIn ? 'badge-green' : 'badge-gray'}`}>
                        {checkedIn ? '已報到' : '未報到'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        onClick={() => handleDelete(r)}
                      >
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddRegistrantModal
          eventId={eventId}
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); fetchData() }}
        />
      )}
    </div>
  )
}
