/**
 * Excel 工具函式
 * 包含：匯入報名者資料、匯出報到記錄
 */
import * as XLSX from 'xlsx'

/**
 * 從 Excel 檔案解析報名者資料
 * @param {File} file - Excel 檔案
 * @returns {Promise<Array>} 解析後的資料陣列
 */
export async function parseRegistrantsFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(new Error('Excel 檔案解析失敗：' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('檔案讀取失敗'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 匯出報到記錄為 Excel
 * @param {Array} checkins - 報到記錄
 * @param {string} eventName - 活動名稱
 */
export function exportCheckinsToExcel(checkins, eventName = '活動') {
  const rows = checkins.map((c, index) => ({
    '序號': index + 1,
    '報名編號': c.registrants?.serial_no || '',
    '姓名': c.registrants?.name || '',
    '手機': c.registrants?.phone || '',
    'Email': c.registrants?.email || '',
    '報到時間': c.checked_at ? new Date(c.checked_at).toLocaleString('zh-TW') : '',
    '操作人員': c.operator_name || '',
    '裝置': c.device_id || '',
    '狀態': c.is_cancelled ? '已取消' : '已報到',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // 設定欄寬
  worksheet['!cols'] = [
    { width: 6 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 24 },
    { width: 20 },
    { width: 12 },
    { width: 16 },
    { width: 8 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '報到記錄')

  const filename = `${eventName}_報到記錄_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`
  XLSX.writeFile(workbook, filename)
}

/**
 * 匯出報名者清單（含備註與自訂欄位）為 Excel
 * @param {Array} registrants
 * @param {string} eventName
 * @param {Array} eventFields - 自訂欄位定義（可選）
 */
export function exportRegistrantsToExcel(registrants, eventName = '活動', eventFields = []) {
  const rows = registrants.map((r, index) => {
    const row = {
      '序號': index + 1,
      '報名編號': r.serial_no || '',
      '姓名': r.name || '',
      '手機': r.phone || '',
      'Email': r.email || '',
      '備註': r.notes || '',
      '報到狀態': (r.checkins?.[0]?.count || 0) > 0 ? '已報到' : '未報到',
    }
    return row
  })

  const colWidths = [
    { width: 6 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 24 }, { width: 20 }, { width: 10 },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '報名者清單')

  const filename = `${eventName}_報名者清單_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`
  XLSX.writeFile(workbook, filename)
}



/**
 * 產生 Excel 匯入範本
 * 說明：姓名為必填，其餘欄位可自由增減。
 * 非標準欄位（姓名/手機/Email/備註）將自動建立為此活動的自訂欄位。
 */
export function downloadImportTemplate() {
  const rows = [
    {
      '姓名': '王小明（必填）',
      '手機': '0912345678',
      'Email': 'wang@example