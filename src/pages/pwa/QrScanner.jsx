import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

export default function QrScanner({ onScan, disabled = false, continuous = false, onReady }) {
  const containerRef = useRef()
  const scannerRef = useRef(null)
  const lastScannedRef = useRef('')
  const lastTimeRef = useRef(0)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    startScanner()
    return () => stopScanner()
  }, [])

  async function startScanner() {
    setLoading(true)
    setError('')
    try {
      const qrId = 'qr-reader-' + Date.now()
      if (containerRef.current) containerRef.current.id = qrId

      const scanner = new Html5Qrcode(qrId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          const now = Date.now()
          if (decodedText === lastScannedRef.current && now - lastTimeRef.current < 2000) return
          lastScannedRef.current = decodedText
          lastTimeRef.current = now
          if (!continuous) await stopScanner()
          if (!disabled) onScan(decodedText)
        },
        () => {}
      )
      setStarted(true)
      if (onReady) onReady()
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('請允許使用相機權限，才能掃描 QR Code')
      } else {
        setError('無法啟動鏡頭：' + (err.message || '未知錯誤'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
    setStarted(false)
  }

  // 提供給父元件重新啟動掃描的方法
  useEffect(() => {
    if (!disabled && !started && !loading && !error) {
      startScanner()
    }
  }, [disabled])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-100 rounded-2xl p-8 text-center min-h-48">
        <CameraOff size={40} className="text-gray-400 mb-3"/>
        <p className="text-sm text-gray-600">{error}</p>
        <button className="btn-primary mt-4" onClick={startScanner}>重試</button>
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-2xl z-10 min-h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-gray-500">啟動鏡頭中...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden"
        style={{ minHeight: '280px' }}
      />
      {!started && !loading && !error && (
        <div className="flex flex-col items-center justify-center bg-gray-100 rounded-2xl p-8 text-center min-h-48">
          <Camera size={40} className="text-gray-400 mb-3"/>
          <button className="btn-primary" onClick={startScanner}>啟動掃描</button>
        </div>
      )}
    </div>
  )
}
