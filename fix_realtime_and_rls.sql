-- 1. リアルタイム同期設定
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.assignments REPLICA IDENTITY FULL;

-- 2. 絶対に無限ループを起こさない「単一責任」のヘルパー関数群
-- すべての権限チェックを SECURITY DEFINER 内部で完結させ、他のポリシーを誘発（再帰）させない構造にします。

CREATE OR REPLACE FUNCTION public.can_read_profile(profile_id uuid) RETURNS boolean AS $$
DECLARE
  caller_role text;
  caller_company uuid;
  caller_shop uuid;
  target_company uuid;
  is_assigned boolean;
BEGIN
  -- 自身の権限情報を取得（RLSをバイパスして直接取得）
  SELECT role, company_id, shop_id INTO caller_role, caller_company, caller_shop 
  FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  
  IF caller_role = 'sys_admin' THEN RETURN true; END IF;

  IF caller_role = 'company_admin' THEN
    SELECT company_id INTO target_company FROM public.profiles WHERE id = profile_id LIMIT 1;
    RETURN caller_company = target_company;
  END IF;

  IF caller_role = 'shop_admin' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.assignments 
      WHERE staff_id = profile_id AND shop_id = caller_shop AND status != 'draft'
    ) INTO is_assigned;
    RETURN is_assigned;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.can_access_order(target_shop_id uuid) RETURNS boolean AS $$
DECLARE
  caller_role text;
  caller_shop uuid;
BEGIN
  SELECT role, shop_id INTO caller_role, caller_shop FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  
  IF caller_role = 'sys_admin' THEN RETURN true; END IF;
  IF caller_role = 'company_admin' THEN RETURN true; END IF;
  IF caller_role = 'shop_admin' THEN RETURN caller_shop = target_shop_id; END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.can_access_assignment(target_staff_id uuid, target_shop_id uuid, target_status text) RETURNS boolean AS $$
DECLARE
  caller_role text;
  caller_company uuid;
  caller_shop uuid;
  target_staff_company uuid;
BEGIN
  SELECT role, company_id, shop_id INTO caller_role, caller_company, caller_shop FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  
  IF caller_role = 'sys_admin' THEN RETURN true; END IF;
  
  IF caller_role = 'company_admin' THEN 
    SELECT company_id INTO target_staff_company FROM public.profiles WHERE id = target_staff_id LIMIT 1;
    RETURN caller_company = target_staff_company;
  END IF;

  IF caller_role = 'shop_admin' THEN 
    RETURN caller_shop = target_shop_id AND target_status != 'draft';
  END IF;

  IF caller_role = 'staff' THEN
    RETURN auth.uid() = target_staff_id AND target_status != 'draft';
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. 各テーブルの究極にシンプルなポリシー設定

-- ==========================
-- profiles
-- ==========================
DROP POLICY IF EXISTS "Profiles ALL" ON profiles;
DROP POLICY IF EXISTS "Profiles SELECT" ON profiles;
DROP POLICY IF EXISTS "Profiles UPDATE" ON profiles;

CREATE POLICY "Profiles SELECT" ON profiles FOR SELECT USING (
  id = auth.uid() OR public.can_read_profile(id)
);

CREATE POLICY "Profiles UPDATE" ON profiles FOR UPDATE USING (
  id = auth.uid() OR public.can_read_profile(id)
) WITH CHECK (
  id = auth.uid() OR public.can_read_profile(id)
);

-- ==========================
-- orders
-- ==========================
DROP POLICY IF EXISTS "Orders ALL" ON orders;
DROP POLICY IF EXISTS "Orders SELECT" ON orders;
DROP POLICY IF EXISTS "Orders INSERT" ON orders;
DROP POLICY IF EXISTS "Orders UPDATE" ON orders;
DROP POLICY IF EXISTS "Orders DELETE" ON orders;

CREATE POLICY "Orders SELECT" ON orders FOR SELECT USING ( public.can_access_order(shop_id) );
CREATE POLICY "Orders INSERT" ON orders FOR INSERT WITH CHECK ( public.can_access_order(shop_id) );
CREATE POLICY "Orders UPDATE" ON orders FOR UPDATE USING ( public.can_access_order(shop_id) ) WITH CHECK ( public.can_access_order(shop_id) );
CREATE POLICY "Orders DELETE" ON orders FOR DELETE USING ( public.can_access_order(shop_id) );

-- ==========================
-- assignments
-- ==========================
DROP POLICY IF EXISTS "Assignments ALL" ON assignments;
DROP POLICY IF EXISTS "Assignments SELECT" ON assignments;
DROP POLICY IF EXISTS "Assignments INSERT" ON assignments;
DROP POLICY IF EXISTS "Assignments UPDATE" ON assignments;
DROP POLICY IF EXISTS "Assignments DELETE" ON assignments;

CREATE POLICY "Assignments SELECT" ON assignments FOR SELECT USING ( public.can_access_assignment(staff_id, shop_id, status) );
CREATE POLICY "Assignments INSERT" ON assignments FOR INSERT WITH CHECK ( public.can_access_assignment(staff_id, shop_id, status) );
CREATE POLICY "Assignments UPDATE" ON assignments FOR UPDATE USING ( public.can_access_assignment(staff_id, shop_id, status) ) WITH CHECK ( public.can_access_assignment(staff_id, shop_id, status) );
CREATE POLICY "Assignments DELETE" ON assignments FOR DELETE USING ( public.can_access_assignment(staff_id, shop_id, status) );

-- ==========================
-- テストデータの補正
-- ==========================
UPDATE public.profiles 
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE role = 'staff' AND company_id IS NULL;

UPDATE public.profiles 
SET shop_id = (SELECT id FROM public.shops LIMIT 1)
WHERE role = 'shop_admin' AND shop_id IS NULL;
