/**
 * PWA 手機端：場次登入狀態管理
 * 使用 sessionStorage 儲存場次資訊（關閉瀏覽器即清除）
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PwaSessionContext = createContext(null)

const SESSION_KEY = 'pwa_session'

export function PwaSessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        setSession(JSON.parse(saved))
      } catch {}
    }
    setLoading(false)
  }, [])

  async function loginWithPassword(sessionId, password) {
    // 取得場次資訊
    const { data, error } = await supabase
      .from('sessions')
      .select('*, events(name, date)')
      .eq('id', sessionId)
      .eq('is_active', true)
      .single()

    if (error || !data) throw new Error('找不到此場次或場次已關閉')

    // 驗證密碼（簡單比對，正式可改為 bcrypt hash 比對）
    if (data.password_hash !== password) throw new Error('密碼錯誤')

    const sessionInfo = {
      sessionId: data.id,
      sessionName: data.name,
      eventId: data.event_id,
      eventName: data.events?.name,
      eventDate: data.events?.date,
      displayFields: data.display_fields || [],
      operatorName: '',
      deviceId: `device_${Date.now()}`,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionInfo))
    setSession(sessionInfo)
    return sessionInfo
  }

  function setOperatorName(name) {
    if (!session) return
    const updated = { ...session, operatorName: name }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    setSession(updated)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  return (
    <PwaSessionContext.Provider value={{ session, loading, loginWithPassword, setOperatorName, logout }}>
      {children}
    </PwaSessionContext.Provider>
  )
}

export function usePwaSession() {
  const ctx = useContext(PwaSessionContext)
  if (!ctx) throw new Error('usePwaSession must be inside PwaSessionProvider')
  return ctx
}
