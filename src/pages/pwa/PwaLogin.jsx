import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QrCode, Eye, EyeOff, LogIn } from 'lucide-react'
import { PwaSessionProvider, usePwaSession } from '../../hooks/usePwaSession'
import toast from 'react-hot-toast'

function LoginForm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithPassword, session } = usePwaSession()
  const [sessionId, setSessionId] = useState(searchParams.get('session') || '')
  const [password, setPassword] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  // 已有 session 直接進入
  useEffect(() => {
    if (session) navigate('/app/checkin', { replace: true })
  }, [session])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sessionId.trim()) { toast.error('請輸入場次 ID'); return }
    if (!password.trim()) { toast.error('請輸入密碼'); return }
    setLoading(true)
    try {
      const info = await loginWithPassword(sessionId.trim(), password.trim())
      if (operatorName.trim()) {
        info.operatorName = operatorName.trim()
        sessionStorage.setItem('pwa_session', JSON.stringify(info))
      }
      toast.success(`歡迎，${info.sessionName} 報到開始！`)
      navigate('/app/checkin', { replace: true })
    } catch (err) {
      toast.error(err.message || '登入失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
            <QrCode size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">活動報到</h1>
          <p className="text-primary-200 mt-1 text-sm">請輸入場次 ID 與密碼</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場次 ID</label>
              <input
                className="input font-mono text-sm"
                placeholder="貼上或掃描場次 ID"
                value={sessionId}
                onChange={e => setSessionId(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">由活動主辦人提供（後台複製連結中含有 ID）</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">報到密碼</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="請輸入場次密碼"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">操作人員姓名（選填）</label>
              <input
                className="input"
                placeholder="例：志工小明"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : <LogIn size={18}/>
              }
              {loading ? '登入中...' : '進入報到'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          此頁面僅供報到工作人員使用
        </p>
      </div>
    </div>
  )
}

export default function PwaLogin() {
  return (
    <PwaSessionProvider>
      <LoginForm />
    </PwaSessionProvider>
  )
}
