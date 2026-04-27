-- =====================================================
-- 活動報名暨報到管理系統 — Supabase 資料庫初始化 SQL
-- 請複製全部貼入 Supabase > SQL Editor > New Query
-- =====================================================

-- 啟用 UUID 擴充功能
create extension if not exists "pgcrypto";

-- =====================================================
-- 1. 活動資料表
-- =====================================================
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date date,
  location text,
  notes text,
  status text default 'active' check (status in ('active', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 2. 活動自訂欄位
-- =====================================================
create table if not exists event_fields (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,
  field_type text default 'text' check (field_type in ('text', 'select', 'number')),
  required boolean default false,
  options jsonb,           -- 下拉選項（select 類型用）
  sort_order int default 0,
  created_at timestamptz default now()
);

-- =====================================================
-- 3. 報名者資料表
-- =====================================================
create table if not exists registrants (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  serial_no text not null,            -- 報名編號，如 0001
  name text not null,
  phone text,
  email text,
  qr_token text unique not null,      -- HMAC 簽章 QR token
  qr_image_url text,                  -- 可選：儲存在 Supabase Storage 的 URL
  notes text,
  created_at timestamptz default now(),
  unique(event_id, serial_no)
);

-- =====================================================
-- 4. 自訂欄位值
-- =====================================================
create table if not exists registrant_field_values (
  id uuid default gen_random_uuid() primary key,
  registrant_id uuid references registrants(id) on delete cascade,
  field_id uuid references event_fields(id) on delete cascade,
  value text,
  unique(registrant_id, field_id)
);

-- =====================================================
-- 5. 報到場次（每場活動可有多個報到窗口）
-- =====================================================
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,                 -- 場次名稱，如「入場報到」
  password_hash text not null,        -- 手機端登入密碼（明文或 hash）
  is_active boolean default true,
  display_fields jsonb default '[]',  -- 報到畫面顯示的欄位
  created_at timestamptz default now()
);

-- =====================================================
-- 6. 報到記錄
-- =====================================================
create table if not exists checkins (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  registrant_id uuid references registrants(id) on delete cascade,
  checked_at timestamptz default now(),
  operator_name text,
  device_id text,
  is_cancelled boolean default false,
  unique(session_id, registrant_id)   -- 每場次每人只能報到一次
);

-- =====================================================
-- 7. 報到操作記錄（稽核日誌）
-- =====================================================
create table if not exists checkin_logs (
  id uuid default gen_random_uuid() primary key,
  checkin_id uuid references checkins(id) on delete cascade,
  action text not null check (action in ('checkin', 'cancel', 'restore', 'edit_time')),
  operator text,
  note text,
  created_at timestamptz default now()
);

-- =====================================================
-- 8. 警示旗標（如 VIP、特殊需求提示）
-- =====================================================
create table if not exists alerts (
  id uuid default gen_random_uuid() primary key,
  registrant_id uuid references registrants(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  message text not null,
  color text default 'yellow',
  created_at timestamptz default now()
);

-- =====================================================
-- 索引（加速查詢）
-- =====================================================
create index if not exists idx_registrants_event_id on registrants(event_id);
create index if not exists idx_registrants_qr_token on registrants(qr_token);
create index if not exists idx_checkins_session_id on checkins(session_id);
create index if not exists idx_checkins_checked_at on checkins(checked_at);
create index if not exists idx_sessions_event_id on sessions(event_id);

-- =====================================================
-- 自動更新 updated_at
-- =====================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on events
  for each row execute function update_updated_at();

-- =====================================================
-- Row Level Security (RLS) 政策
-- =====================================================

-- 啟用 RLS
alter table events enable row level security;
alter table event_fields enable row level security;
alter table registrants enable row level security;
alter table registrant_field_values enable row level security;
alter table sessions enable row level security;
alter table checkins enable row level security;
alter table checkin_logs enable row level security;
alter table alerts enable row level security;

-- 後台管理員（已登入用戶）可完整存取
create policy "authenticated_all" on events for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on event_fields for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on registrants for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on registrant_field_values for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on sessions for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on checkins for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on checkin_logs for all using (auth.role() = 'authenticated');
create policy "authenticated_all" on alerts for all using (auth.role() = 'authenticated');

-- 匿名用戶（手機端 PWA）可讀取活動與場次（用於登入驗證）
create policy "anon_read_sessions" on sessions
  for select using (is_active = true);

create policy "anon_read_registrants" on registrants
  for select using (true);

-- 匿名用戶可新增報到記錄
create policy "anon_insert_checkins" on checkins
  for insert with check (true);

-- 匿名用戶可更新報到記錄（取消）
create policy "anon_update_checkins" on checkins
  for update using (true);

-- 匿名用戶可讀取報到記錄（即時統計）
create policy "anon_read_checkins" on checkins
  for select using (true);

-- =====================================================
-- 完成！
-- =====================================================
-- 執行後請到 Authentication > Users 建立你的管理員帳號
