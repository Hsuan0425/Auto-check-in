# 活動報名暨報到管理系統 — 部署指南

## 📋 第一步：建立 Supabase 帳號與專案

1. 前往 https://supabase.com 點選「Start your project」
2. 以 GitHub 帳號登入（免費）
3. 點選「New project」
4. 填入：
   - **Project name**：event-checkin（任意名稱）
   - **Database Password**：設定一組強密碼（請記下）
   - **Region**：Southeast Asia (Singapore) — 台灣最近的節點
5. 等待約 2 分鐘建立完成

## 📋 第二步：建立資料庫

1. 在 Supabase 左側選單點「SQL Editor」
2. 點「New Query」
3. 將 `supabase_setup.sql` 的全部內容貼入
4. 點選「Run」執行

## 📋 第三步：建立管理員帳號

1. 左側選單點「Authentication」→「Users」
2. 點「Add user」→「Create new user」
3. 輸入你的 Email 與密碼
4. 點「Create user」

## 📋 第四步：取得 API 金鑰

1. 左側選單點「Settings」→「API」
2. 複製以下兩個值：
   - **Project URL**：`https://xxxxx.supabase.co`
   - **anon public key**：`eyJ...`（很長的字串）

## 📋 第五步：設定環境變數

1. 在專案資料夾 `event-checkin\` 中建立 `.env` 檔案
2. 內容如下（替換為你的值）：

```
VITE_SUPABASE_URL=https://你的專案ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon公開金鑰
VITE_QR_SECRET=請填入至少32個字元的隨機字串例如ABC123XYZ456DEF789GHI012JKL345
```

3. `.env` 檔案已在 `.gitignore` 中，不會上傳到 GitHub

## 📋 第六步：安裝相依套件並啟動

打開命令提示字元（在 `event-checkin\` 資料夾）：

```bash
npm install
npm run dev
```

瀏覽器開啟 http://localhost:5173 即可看到後台登入頁

## 📋 第七步：部署到 Vercel（線上環境）

1. 前往 https://github.com 建立一個新的 Repository（如 `event-checkin`）
2. 在 `event-checkin\` 資料夾執行：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/你的帳號/event-checkin.git
   git push -u origin main
   ```
3. 前往 https://vercel.com 以 GitHub 登入
4. 點「New Project」→ 選擇你的 `event-checkin` repo
5. 在「Environment Variables」填入：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_QR_SECRET`
6. 點「Deploy」，等待 1-2 分鐘即完成！
7. Vercel 會提供一個網址如 `https://event-checkin-xxx.vercel.app`

## 📱 手機端（PWA）使用方式

1. 在後台建立活動 → 新增報到場次 → 設定密碼
2. 複製場次連結（如 `https://你的網址/app?session=xxx-xxx`）
3. 在手機瀏覽器開啟此連結
4. 輸入密碼登入後即可開始報到
5. iPhone：點 Safari 下方「分享」→「加入主畫面」即可安裝為 APP

## ⚠️ 注意事項

- **iOS 相機**：必須在 HTTPS 環境下才能使用（Vercel 已提供）
- **Supabase 免費方案**：超過 1 週不使用會自動休眠，可安裝 UptimeRobot 定時 ping 避免休眠
- **離線功能**：手機端在無網路時可繼續報到，聯網後自動同步

## 🔒 安全提醒

- `.env` 檔案絕對不要上傳到 GitHub（已設定 .gitignore）
- `VITE_QR_SECRET` 請設定一組高強度隨機字串
- Supabase 的 RLS 政策已設定，未登入用戶只能新增報到記錄，不能刪除資料
