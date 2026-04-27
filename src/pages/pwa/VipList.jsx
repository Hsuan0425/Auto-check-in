import { useEffect, useState } from 'react'
import { Crown, RefreshCw, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePwaSession } from '../../hooks/usePwaSession'

export default function VipList() {
  const { session } = usePwaSession()
  const [vips, setVips] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => { if (session?.eventId) fetchVips() }, [session?.eventId])

  async function fetchVips() {
    setLoading(true)
    const { data, error } = await supabase
      .from('registrants')
      .select(`
        id, serial_no, name, phone, is_vip,
        checkins(id, checked_at, is_cancelled)
      `)
      .eq('event_id', session.eventId)
      .eq('is_vip', true)
      .order('serial_no')
    if (!error) {
      setVips(data || [])
      setLastUpdated(new Date())
    }
    setLoading(false)
  }

  const checkedIn = vips.filter(v => v.checkins?.some(c => !c.is_cancelled))
  const notYet = vips.filter(v => !v.checkins?.some(c => !c.is_cancelled))

  function formatTime(checkins) {
    const valid = checkins?.find(c => !c.is_cancelled)
    if (!valid?.checked_at) return null
    return new Date(valid.checked_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-4 space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Crown size={18} className="text-amber-500" /> VIP 貴賓名單
          </h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              更新於 {lastUpdated.toLocaleTimeString('zh-TW')}
            </p>
          )}
        </div>
        <button
          onClick={fetchVips}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{vips.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">VIP 總數</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{checkedIn.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">已報到</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">{notYet.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">未報到</p>
        </div>
      </div>

      {loading ? (
        <div className="card p-10 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vips.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Crown size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">尚無 VIP 貴賓</p>
          <p className="text-xs mt-1">請至後台報名者列表點選皇冠圖示設定</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 未報到區塊 */}
          {notYet.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 px-1">
                ⏳ 尚未報到（{notYet.length} 位）
              </p>
              <div className="card divide-y divide-gray-50">
                {notYet.map(v => (
                  <div key={v.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Crown size={13} className="text-amber-400" />
                        <span className="font-medium text-gray-900">{v.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{v.serial_no}</span>
                      </div>
                      {v.phone && (
                        <a href={'tel:' + v.phone} className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                          <Phone size={10} />{v.phone}
                        </a>
                      )}
                    </div>
                    <span className="badge badge-gray text-xs">未報到</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 已報到區塊 */}
          {checkedIn.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2 px-1">
                ✅ 已報到（{checkedIn.length} 位）
              </p>
              <div className="card divide-y divide-gray-50">
                {checkedIn.map(v => (
                  <div key={v.id} className="px-4 py-3 flex items-center justify-between opacity-75">
                    <div>
                      <div className="flex items-center gap-2">
                        <Crown size={13} className="text-amber-400" />
                        <span className="font-medium text-gray-700">{v.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{v.serial_no}</span>
                      </div>
                      {v.phone && (
                        <a href={'tel:' + v.phone} className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                          <Phone size={10} />{v.phone}
                        </a>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="badge badge-green text-xs">已報到</span>
                      {formatTime(v.checkins) && (
                        <p className="text-xs text-gray-400 mt-1">{formatTime(v.checkins)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
