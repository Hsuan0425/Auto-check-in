import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, QrCode } from 'lucide-react'
import { useEffect } from 'react'

export default function CheckinResult() {
  const location = useLocation()
  const navigate = useNavigate()
  const result = location.state

  // 若直接開啟此頁（無 state），跳回掃描頁
  useEffect(() => {
    if (!result) navigate('/app/checkin', { replace: true })
  }, [])

  if (!result) return null

  const { success, duplicate, name, offline, time } = result

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-6">
      <div className={`w-full max-w-sm rounded-3xl p-8 text-center shadow-lg ${
        duplicate
          ? 'bg-yellow-50 border-2 border-yellow-300'
          : success
          ? 'bg-green-50 border-2 border-green-300'
          : 'bg-red-50 border-2 border-red-300'
      }`}>
        {/* 圖示 */}
        {duplicate ? (
          <AlertTriangle size={72} className="text-yellow-500 mx-auto mb-4"/>
        ) : success ? (
          <CheckCircle size={72} className="text-green-500 mx-auto mb-4"/>
        ) : (
          <XCircle size={72} className="text-red-500 mx-auto mb-4"/>
        )}

        {/* 標題 */}
        <h2 className={`text-2xl font-bold mb-2 ${
          duplicate ? 'text-yellow-700' : success ? 'text-green-700' : 'text-red-700'
        }`}>
          {duplicate ? '重複報到' : success ? '報到成功' : '報到失敗'}
        </h2>

        {/* 姓名 */}
        {name && (
          <p className={`text-3xl font-bold my-4 ${
            duplicate ? 'text-yellow-800' : success ? 'text-green-800' : 'text-red-800'
          }`}>
            {name}
          </p>
        )}

        {/* 附加資訊 */}
        <div className="space-y-1 text-sm">
          {duplicate && (
            <p className="text-yellow-600">此人已於稍早完成報到，請確認是否重複刷卡</p>
          )}
          {success && time && (
            <p className="text-green-600">
              {new Date(time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          {success && offline && (
            <p className="text-orange-600 bg-orange-100 rounded-lg px-3 py-1.5 mt-2">
              ⚠️ 離線模式：記錄已暫存，聯網後自動同步
            </p>
          )}
        </div>
      </div>

      {/* 按鈕區 */}
      <div className="w-full max-w-sm mt-6 space-y-3">
        <button
          className="btn-primary w-full py-4 text-lg"
          onClick={() => navigate('/app/checkin')}
        >
          <QrCode size={20}/> 繼續下一位
        </button>
        <button
          className="btn-secondary w-full py-3"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16}/> 返回
        </button>
      </div>
    </div>
  )
}
