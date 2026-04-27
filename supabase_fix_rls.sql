-- 修復 RLS 政策：補上 WITH CHECK 讓已登入用戶可以新增資料
-- 請到 Supabase > SQL Editor 執行此檔案

-- 刪除舊政策
DROP POLICY IF EXISTS "authenticated_all" ON events;
DROP POLICY IF EXISTS "authenticated_all" ON event_fields;
DROP POLICY IF EXISTS "authenticated_all" ON registrants;
DROP POLICY IF EXISTS "authenticated_all" ON registrant_field_values;
DROP POLICY IF EXISTS "authenticated_all" ON sessions;
DROP POLICY IF EXISTS "authenticated_all" ON checkins;
DROP POLICY IF EXISTS "authenticated_all" ON checkin_logs;
DROP POLICY IF EXISTS "authenticated_all" ON alerts;

-- 重建正確的政策（含 WITH CHECK）
CREATE POLICY "authenticated_all" ON events FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON event_fields FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON registrants FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON registrant_field_values FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON sessions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON checkins FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON checkin_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON alerts FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 匿名用戶政策也補上 WITH CHECK
DROP POLICY IF EXISTS "anon_insert_checkins" ON checkins;
DROP POLICY IF EXISTS "anon_update_checkins" ON checkins;

CREATE POLICY "anon_insert_checkins" ON checkins
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_checkins" ON checkins
  FOR UPDATE USING (true) WITH CHECK (true);
