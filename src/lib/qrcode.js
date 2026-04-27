/**
 * QR Code 工具函式
 * 包含：產生簽章 token、生成 QR Code 圖片
 */
import QRCode from 'qrcode'

const QR_SECRET = import.meta.env.VITE_QR_SECRET || 'default-secret-please-change'

/**
 * 以 HMAC-SHA256 簽章產生 QR Token（瀏覽器端 Web Crypto API）
 */
export async function generateQRToken(registrantId) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(QR_SECRET)
  const messageData = encoder.encode(registrantId)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  // token 格式：registrantId.前16碼簽章
  return `${registrantId}.${hashHex.slice(0, 16)}`
}

/**
 * 驗證 QR Token
 */
export async function verifyQRToken(token) {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [registrantId, providedSig] = parts
  const expected = await generateQRToken(registrantId)
  const expectedSig = expected.split('.')[1]

  if (providedSig !== expectedSig) return null
  return registrantId
}

/**
 * 產生 QR Code 為 base64 Data URL（1000×1000 px）
 */
export async function generateQRCodeDataURL(token, options = {}) {
  const opts = {
    width: 1000,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
    ...options,
  }

  return await QRCode.toDataURL(token, opts)
}

/**
 * 產生 QR Code 為 PNG Blob
 */
export async function generateQRCodeBlob(token) {
  const dataUrl = await generateQRCodeDataURL(token)
  const response = await fetch(dataUrl)
  return await response.blob()
}
