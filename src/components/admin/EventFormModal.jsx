import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function EventFormModal({ event, onClose, onSave }) {
  const isEdit = !!event

  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    notes: '',
    status: 'active',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name || '',
        date: event.date || '',
        location: event.location || '',
        notes: event.notes || '',
        status: event.status || 'active',
      })
    }
  }, [event])

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('請輸入活動名稱')
      return
    }
    setLoading(true)
    try {
      if (isEdit) {
        const { error } = await supabase
          .from('events')
          .update(form)
          .eq('id', event.id)
        if (error) throw error
        toast.success('活動已更新')
      } else {
        const { error } = await supabase.from('events').insert([form])
        if (error) throw error
        toast.success('活動已新增')
      }
      onSave()
    } catch (err) {
      toast.error((isEdit ? '更新' : '新增') + '失敗：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? '編輯活動' : '新增活動'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              活動名稱 <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              placeholder="例：2025 年度春季晚宴"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                活動日期
              </label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={e => handleChange('date', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                狀態
              </label>
              <select
                className="input"
                value={form.status}
                onChange={e => handleChange('status', e.target.value)}
              >
                <option value="active">進行中</option>
                <option value="closed">已結束</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              活動地點
            </label>
            <input
              className="input"
              placeholder="例：台北國際會議中心"
              value={form.location}
              onChange={e => handleChange('location', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備註
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="選填，活動相關備註說明..."
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              取消
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
