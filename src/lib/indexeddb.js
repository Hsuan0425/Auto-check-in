/**
 * IndexedDB 離線儲存工具
 * 用於 PWA 手機端離線報到資料暫存與同步
 */

const DB_NAME = 'event-checkin-offline'
const DB_VERSION = 1
const STORE_PENDING = 'pending_checkins'
const STORE_REGISTRANTS = 'cached_registrants'

let db = null

async function openDB() {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const database = event.target.result

      // 待同步的報到記錄
      if (!database.objectStoreNames.contains(STORE_PENDING)) {
        const store = database.createObjectStore(STORE_PENDING, {
          keyPath: 'localId',
          autoIncrement: true,
        })
        store.createIndex('session_id', 'session_id', { unique: false })
        store.createIndex('synced', 'synced', { unique: false })
      }

      // 快取的報名者資料（供離線查詢）
      if (!database.objectStoreNames.contains(STORE_REGISTRANTS)) {
        const store = database.createObjectStore(STORE_REGISTRANTS, {
          keyPath: 'id',
        })
        store.createIndex('qr_token', 'qr_token', { unique: true })
        store.createIndex('session_id', 'session_id', { unique: false })
        store.createIndex('serial_no', 'serial_no', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      db = event.target.result
      resolve(db)
    }

    request.onerror = () => reject(request.error)
  })
}

// ===== 報名者快取 =====

export async function cacheRegistrants(sessionId, registrants) {
  const database = await openDB()
  const tx = database.transaction(STORE_REGISTRANTS, 'readwrite')
  const store = tx.objectStore(STORE_REGISTRANTS)

  for (const r of registrants) {
    await new Promise((res, rej) => {
      const req = store.put({ ...r, session_id: sessionId })
      req.onsuccess = res
      req.onerror = rej
    })
  }

  return new Promise((res, rej) => {
    tx.oncomplete = res
    tx.onerror = rej
  })
}

export async function getCachedRegistrantByToken(qrToken) {
  const database = await openDB()
  const tx = database.transaction(STORE_REGISTRANTS, 'readonly')
  const store = tx.objectStore(STORE_REGISTRANTS)
  const index = store.index('qr_token')

  return new Promise((resolve, reject) => {
    const req = index.get(qrToken)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = reject
  })
}

export async function getCachedRegistrantBySerial(sessionId, serialNo) {
  const database = await openDB()
  const tx = database.transaction(STORE_REGISTRANTS, 'readonly')
  const store = tx.objectStore(STORE_REGISTRANTS)
  const allReq = store.getAll()

  return new Promise((resolve, reject) => {
    allReq.onsuccess = () => {
      const result = allReq.result.find(
        r => r.session_id === sessionId && r.serial_no === serialNo
      )
      resolve(result || null)
    }
    allReq.onerror = reject
  })
}

export async function clearCachedRegistrants(sessionId) {
  const database = await openDB()
  const tx = database.transaction(STORE_REGISTRANTS, 'readwrite')
  const store = tx.objectStore(STORE_REGISTRANTS)
  const index = store.index('session_id')

  return new Promise((resolve, reject) => {
    const req = index.getAllKeys(sessionId)
    req.onsuccess = () => {
      req.result.forEach(key => store.delete(key))
      resolve()
    }
    req.onerror = reject
  })
}

// ===== 離線報到記錄 =====

export async function addPendingCheckin(checkinData) {
  const database = await openDB()
  const tx = database.transaction(STORE_PENDING, 'readwrite')
  const store = tx.objectStore(STORE_PENDING)

  return new Promise((resolve, reject) => {
    const req = store.add({
      ...checkinData,
      synced: false,
      created_at: new Date().toISOString(),
    })
    req.onsuccess = () => resolve(req.result)
    req.onerror = reject
  })
}

export async function getPendingCheckins() {
  const database = await openDB()
  const tx = database.transaction(STORE_PENDING, 'readonly')
  const store = tx.objectStore(STORE_PENDING)
  const index = store.index('synced')

  return new Promise((resolve, reject) => {
    const req = index.getAll(false)
    req.onsuccess = () => resolve(req.result)
    req.onerror = reject
  })
}

export async function markCheckinSynced(localId) {
  const database = await openDB()
  const tx = database.transaction(STORE_PENDING, 'readwrite')
  const store = tx.objectStore(STORE_PENDING)

  return new Promise((resolve, reject) => {
    const getReq = store.get(localId)
    getReq.onsuccess = () => {
      const record = getReq.result
      if (record) {
        record.synced = true
        const putReq = store.put(record)
        putReq.onsuccess = resolve
        putReq.onerror = reject
      } else {
        resolve()
      }
    }
    getReq.onerror = reject
  })
}

export async function getPendingCount() {
  const pending = await getPendingCheckins()
  return pending.length
}
