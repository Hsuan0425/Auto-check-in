import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Search, Edit3, Wifi, WifiOff, BarChart2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { verifyQRToken } from '../../lib/qrcode'
import { addPendingCheckin, getCachedRegistrantByToken, getCachedRegistrantBySerial, getPendingCount, cacheRegistrants } from '../../lib/indexeddb'
import { usePwaSession } from '../../hooks/usePwaSession'
import toast from 'react-hot-toast'
import QrScanner from './QrScanner'

const MODE_QR = 'qr'
const MODE_FAST = 'fast'
const MODE_MANUAL = 'manual'

export default function CheckinMain() {
  const { session } = usePwaSession()
  const navigate = useNavigate()
  const [mode, setMode] = useState(MODE_QR)
  const [manualSerial, setManualSerial] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const manualInputRef = useRef()

  useEffect(() => {
    // 監聽網路狀態
    const onOnline = () => { setIsOnline(true); syncPending() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // 載入離線待同步數量
    updatePendingCount()

    // 快取報名者資料供離線使用
    if (isOnline) preloadRegistrants()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  async function updatePendingCount() {
    const count = await getPendingCount()
    setPendingCount(count)
  }

  async function preloadRegistrants() {
    try {
      const { data } = await supabase
        .from('registrants')
        .select('id, serial_no, name, phone, email, qr_token')
        .eq('event_id', session.eventId)
      if (data) await cacheRegistrants(session.sessionId, data)
    } catch {}
  }

  // 執行報到邏輯
  async function performCheckin(registrantId, name) {
    if (processing) return
    setProcessing(true)

    try {
      const checkinData = {
        session_id: session.sessionId,
        registrant_id: registrantId,
        checked_at: new Date().toISOString(),
        operator_name: session.operatorName || '工作人員',
        device_id: session.deviceId,
        is_cancelled: false,
      }

      if (isOnline) {
        // 線上模式：直接寫入 Supabase
        const { error } = await supabase.from('checkins').insert([checkinData])
        if (error) {
          if (error.code === '23505') {
            // UNIQUE 衝突 = 重複報到
            const result = { success: false, duplicate: true, name }
            setLastResult(result)
            navigate('/app/checkin/result', { state: result })
            return
          }
          throw error
        }
      } else {
        // 離線模式：存入 IndexedDB
        await addPendingCheckin(checkinData)
        await updatePendingCount()
      }

      const result = {
        success: true,
        duplicate: false,
        name,
        offline: !isOnline,
        time: checkinData.checked_at,
      }
      setLastResult(result)

      if (mode === MODE_FAST) {
        // 快速模式：直接顯示結果 toast，不跳頁
        toast.success(`✓ ${name} 報到成功${!isOnline ? '（離線）' : ''}`, { duration: 2000 })
      } else {
        navigate('/app/checkin/result', { state: result })
      }
    } catch (err) {
      toast.error('報到失敗：' + (err.message || '請重試'))
    } finally {
      setProcessing(false)
    }
  }

  // QR Code 掃描回呼
  async function handleQRScan(rawToken) {
    if (processing) return
    // 驗證 token
    const registrantId = await verifyQRToken(rawToken)
    if (!registrantId) {
      toast.error('無效的 QR Code')
      return
    }
    // 查詢報名者
    let registrant = null
    if (isOnline) {
      const { data } = await supabase
        .from('registrants')
        .select('id, name')
        .eq('qr_token', rawToken)
        .single()
      registrant = data
    } else {
      registrant = await getCachedRegistrantByToken(rawToken)
    }
    if (!registrant) {
      toast.error('找不到此報名者')
      return
    }
    await performCheckin(registrant.id, registrant.name)
  }

  // 手動輸入報到
  async function handleManualCheckin(e) {
    e.preventDefault()
    const serial = manualSerial.trim()
    if (!serial) return
    setProcessing(true)
    try {
      let registrant = null
      if (isOnline) {
        const { data } = await supabase
          .from('registrants')
          .select('id, name')
          .eq('event_id', session.eventId)
          .eq('serial_no', serial)
          .single()
        registrant = data
      } else {
        registrant = await getCachedRegistrantBySerial(session.sessionId, serial)
      }
      if (!registrant) {
        toast.error(`找不到編號 ${serial} 的報名者`)
        setProcessing(false)
        return
      }
      setManualSerial('')
      await performCheckin(registrant.id, registrant.name)
    } catch (err) {
      toast.error('查詢失敗：' + err.message)
      setProcessing(false)
    }
  }

  // 同步離線資料
  async function syncPending() {
    const { getPendingCheckins, markCheckinSynced } = await import('../../lib/indexeddb')
    const pending = await getPendingCheckins()
    if (pending.length === 0) return

    let synced = 0
    for (const item of pending) {
      try {
        const { error } = await supabase.from('checkins').insert([{
          session_id: item.session_id,
          registrant_id: item.registrant_id,
          checked_at: item.checked_at,
          operator_name: item.operator_name,
          device_id: item.device_id,
          is_cancelled: item.is_cancelled,
        }])
        if (!error || error.code === '23505') {
          await markCheckinSynced(item.localId)
          synced++
        }
      } catch {}
    }
    if (synced > 0) {
      toast.success(`已同步 ${synced} 筆離線報到記錄`)
      updatePendingCount()
    }
  }

  const tabs = [
    { id: MODE_QR, icon: QrCode, label: '掃描模式' },
    { id: MODE_FAST, icon: Search, label: '快速模式' },
    { id: MODE_MANUAL, icon: Edit3, label: '手動輸入' },
  ]

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* 狀態列 */}
      <div className={`flex items-center justify-between px-4 py-2 text-xs ${
        isOnline ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
      }`}>
        <span className="flex items-center gap-1.5">
          {isOnline ? <Wifi size={13}/> : <WifiOff size={13}/>}
          {isOnline ? '線上' : '離線模式'}
          {pendingCount > 0 && `（${pendingCount} 筆待同步）`}
        </span>
        <div className="flex gap-3">
          {pendingCount > 0 && isOnline && (
            <button onClick={syncPending} className="underline">立即同步</button>
          )}
          <button onClick={() => navigate('/app/checkin/stats')} className="flex items-center gap-1">
            <BarChart2 size={13}/> 統計
          </button>
        </div>
      </div>

      {/* 模式切換 Tab */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors border-b-2 ${
              mode === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode(tab.id)}
          >
            <tab.icon size={18} className="mb-0.5"/>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 各模式內容 */}
      <div className="flex-1 p-4">
        {/* QR 掃描模式 */}
        {mode === MODE_QR && (
          <div>
            <p className="text-center text-sm text-gray-500 mb-4">
              請將 QR Code 對準鏡頭框
            </p>
            <QrScanner
              onScan={handleQRScan}
              disabled={processing}
            />
            {processing && (
              <div className="text-center mt-4 text-primary-600 flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
                處理中...
              </div>
            )}
          </div>
        )}

        {/* 快速模式：連續掃描不跳頁 */}
        {mode === MODE_FAST && (
          <div>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
              快速模式：掃描後直接顯示結果，不切換頁面，適合大量報到。
            </div>
            <QrScanner
              onScan={handleQRScan}
              disabled={processing}
              continuous={true}
            />
          </div>
        )}

        {/* 手動輸入模式 */}
        {mode === MODE_MANUAL && (
          <div className="max-w-sm mx-auto">
            <p className="text-center text-sm text-gray-500 mb-6">
              輸入報名編號進行報到
            </p>
            <form onSubmit={handleManualCheckin} className="space-y-3">
              <input
                ref={manualInputRef}
                className="input text-center text-2xl font-mono tracking-widest py-4"
                placeholder="0001"
                value={manualSerial}
                onChange={e => setManualSerial(e.target.value)}
                autoFocus
                inputMode="numeric"
              />
              <button
                type="submit"
                disabled={processing || !manualSerial.trim()}
                className="btn-primary w-full py-4 text-lg"
              >
                {processing
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : <Edit3 size={20}/>
                }
                {processing ? '處理中...' : '確認報到'}
              </button>
            </form>

            {/* 快速數字鍵盤（補充） */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[1,2,3,4,5,6,7,8,9,'清除',0,'報到'].map(key => (
                <button
                  key={key}
                  className={`py-4 rounded-xl text-lg font-medium transition-colors ${
                    key === '報到'
                      ? 'bg-primary-600 text-white col-span-1'
                      : key === '清除'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (key === '清除') setManualSerial('')
                    else if (key === '報到') {
                      if (manualSerial) {
                        const fakeEvent = { preventDefault: () => {} }
                        handleManualCheckin(fakeEvent)
                      }
                    } else {
                      setManualSerial(prev => (prev + key).slice(0, 6))
                    }
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
