import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Search, Edit3, Wifi, WifiOff, BarChart2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
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
  const [scanResult, setScanResult] = useState(null) // 覆蓋在掃描畫面上的結果
  const [nameSearch, setNameSearch] = useState('')
  const [nameResults, setNameResults] = useState([])
  const [nameSearching, setNameSearching] = useState(false)
  const manualInputRef = useRef()
  const resultTimerRef = useRef()

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncPending() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    updatePendingCount()
    if (isOnline) preloadRegistrants()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
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

  // 顯示結果 overlay，2 秒後自動消失並繼續掃描
  function showResult(result) {
    setScanResult(result)
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    resultTimerRef.current = setTimeout(() => {
      setScanResult(null)
      setProcessing(false)
    }, 2000)
  }

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
        const { error } = await supabase.from('checkins').insert([checkinData])
        if (error) {
          if (error.code === '23505') {
            showResult({ success: false, duplicate: true, name })
            return
          }
          throw error
        }
      } else {
        await addPendingCheckin(checkinData)
        await updatePendingCount()
      }

      showResult({ success: true, name, offline: !isOnline })
    } catch (err) {
      toast.error('報到失敗：' + (err.message || '請重試'))
      setProcessing(false)
    }
  }

  async function handleQRScan(rawToken) {
    if (processing) return
    const registrantId = await verifyQRToken(rawToken)
    if (!registrantId) {
      toast.error('無效的 QR Code')
      return
    }
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

  async function handleNameSearch(keyword) {
    setNameSearch(keyword)
    if (!keyword.trim()) { setNameResults([]); return }
    setNameSearching(true)
    try {
      const { data } = await supabase
        .from('registrants')
        .select('id, serial_no, name, phone')
        .eq('event_id', session.eventId)
        .ilike('name', '%' + keyword + '%')
        .limit(8)
      setNameResults(data || [])
    } catch {}
    setNameSearching(false)
  }

  async function handleNameCheckin(registrant) {
    setNameSearch('')
    setNameResults([])
    await performCheckin(registrant.id, registrant.name)
  }

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
      <div className="flex-1 p-4 relative">

        {/* 掃描結果 overlay（全模式共用） */}
        {scanResult && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-xl"
            onClick={() => { setScanResult(null); setProcessing(false); if (resultTimerRef.current) clearTimeout(resultTimerRef.current) }}>
            <div className={`rounded-2xl px-10 py-8 text-center shadow-2xl mx-6 w-full max-w-xs ${
              scanResult.success ? 'bg-green-50' : scanResult.duplicate ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              {scanResult.success
                ? <CheckCircle size={56} className="mx-auto mb-3 text-green-500"/>
                : scanResult.duplicate
                  ? <AlertCircle size={56} className="mx-auto mb-3 text-amber-500"/>
                  : <XCircle size={56} className="mx-auto mb-3 text-red-500"/>
              }
              <p className="text-2xl font-bold text-gray-900 mb-1">{scanResult.name}</p>
              <p className={`text-base font-medium ${
                scanResult.success ? 'text-green-600' : scanResult.duplicate ? 'text-amber-600' : 'text-red-600'
              }`}>
                {scanResult.success
                  ? `✓ 報到成功${scanResult.offline ? '（離線）' : ''}`
                  : scanResult.duplicate ? '⚠ 已重複報到' : '✗ 報到失敗'}
              </p>
              <p className="text-xs text-gray-400 mt-3">點任意處繼續掃描</p>
            </div>
          </div>
        )}

        {/* QR 掃描模式 */}
        {mode === MODE_QR && (
          <div>
            <p className="text-center text-sm text-gray-500 mb-4">請將 QR Code 對準鏡頭框</p>
            <QrScanner onScan={handleQRScan} disabled={processing} continuous={true} />
          </div>
        )}

        {/* 快速模式 */}
        {mode === MODE_FAST && (
          <div>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
              快速模式：掃描後直接顯示結果，不切換頁面，適合大量報到。
            </div>
            <QrScanner onScan={handleQRScan} disabled={processing} continuous={true} />
          </div>
        )}

        {/* 手動輸入模式 */}
        {mode === MODE_MANUAL && (
          <div className="max-w-sm mx-auto">
            {/* 姓名搜尋 */}
            <div className="mb-5">
              <p className="text-center text-sm text-gray-500 mb-3">搜尋姓名快速報到</p>
              <div className="relative">
                <input
                  className="input pl-9"
                  placeholder="輸入中文姓名搜尋..."
                  value={nameSearch}
                  onChange={e => handleNameSearch(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {nameSearching
                    ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block"/>
                    : <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  }
                </span>
              </div>
              {nameResults.length > 0 && (
                <div className="mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  {nameResults.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleNameCheckin(r)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-primary-50 border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.phone || '無電話'}</p>
                      </div>
                      <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{r.serial_no}</span>
                    </button>
                  ))}
                </div>
              )}
              {nameSearch && !nameSearching && nameResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 mt-2">找不到「{nameSearch}」</p>
              )}
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"/></div>
              <div className="relative flex justify-center"><span className="bg-gray-50 px-3 text-xs text-gray-400">或輸入編號</span></div>
            </div>

            <p className="text-center text-sm text-gray-500 mb-3">輸入報名編號進行報到</p>
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
}
