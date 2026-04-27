-- ========================================================
-- DispatchPRO Security Policies (Row Level Security) - FIX
-- ========================================================

-- 1. 古いポリシーを完全に削除
DROP POLICY IF EXISTS "Public full access inside companies" ON companies;
DROP POLICY IF EXISTS "Public full access inside shops" ON shops;
DROP POLICY IF EXISTS "Public full access inside profiles" ON profiles;
DROP POLICY IF EXISTS "Public full access inside shop_rates" ON shop_rates;
DROP POLICY IF EXISTS "Public full access inside orders" ON orders;
DROP POLICY IF EXISTS "Public full access inside assignments" ON assignments;

DROP POLICY IF EXISTS "Profiles SELECT" ON profiles;
DROP POLICY IF EXISTS "Profiles UPDATE" ON profiles;
DROP POLICY IF EXISTS "Orders SELECT" ON orders;
DROP POLICY IF EXISTS "Orders ALL" ON orders;
DROP POLICY IF EXISTS "Assignments SELECT" ON assignments;
DROP POLICY IF EXISTS "Assignments ALL" ON assignments;
DROP POLICY IF EXISTS "Companies SELECT" ON companies;
DROP POLICY IF EXISTS "Companies ALL" ON companies;
DROP POLICY IF EXISTS "Shops SELECT" ON shops;
DROP POLICY IF EXISTS "Shops ALL" ON shops;
DROP POLICY IF EXISTS "ShopRates SELECT" ON shop_rates;
DROP POLICY IF EXISTS "ShopRates ALL" ON shop_rates;

-- 2. 無限ループを防ぐためのセキュアなヘルパー関数群
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text AS $$
DECLARE
  my_role text;
BEGIN
  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN my_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_company_id() RETURNS uuid AS $$
DECLARE
  my_id uuid;
BEGIN
  SELECT company_id INTO my_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN my_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_shop_id() RETURNS uuid AS $$
DECLARE
  my_id uuid;
BEGIN
  SELECT shop_id INTO my_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN my_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ★ ループの根本原因（profiles と assignments の相互参照）を断ち切るヘルパー関数 ★
CREATE OR REPLACE FUNCTION public.is_my_company_staff(check_staff_id uuid) RETURNS boolean AS $$
DECLARE
  staff_company uuid;
  my_company uuid;
BEGIN
  SELECT company_id INTO staff_company FROM public.profiles WHERE id = check_staff_id LIMIT 1;
  SELECT company_id INTO my_company FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN staff_company = my_company;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_assigned_to_my_shop(check_staff_id uuid) RETURNS boolean AS $$
DECLARE
  is_assigned boolean;
  my_shop uuid;
BEGIN
  SELECT shop_id INTO my_shop FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  SELECT EXISTS (
    SELECT 1 FROM public.assignments 
    WHERE staff_id = check_staff_id AND shop_id = my_shop AND status != 'draft'
  ) INTO is_assigned;
  RETURN is_assigned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. 各テーブルのポリシー設定

-- ==========================
-- companies / shops / shop_rates
-- ==========================
CREATE POLICY "Companies SELECT" ON companies FOR SELECT USING (true);
CREATE POLICY "Companies ALL" ON companies FOR ALL USING (public.get_my_role() = 'sys_admin');

CREATE POLICY "Shops SELECT" ON shops FOR SELECT USING (true);
CREATE POLICY "Shops ALL" ON shops FOR ALL USING (public.get_my_role() = 'sys_admin');

CREATE POLICY "ShopRates SELECT" ON shop_rates FOR SELECT USING (true);
CREATE POLICY "ShopRates ALL" ON shop_rates FOR ALL USING (public.get_my_role() = 'sys_admin');

-- ==========================
-- profiles
-- ==========================
CREATE POLICY "Profiles SELECT" ON profiles FOR SELECT USING (
  public.get_my_role() = 'sys_admin' OR
  id = auth.uid() OR
  (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id()) OR
  (public.get_my_role() = 'shop_admin' AND public.is_assigned_to_my_shop(id))
);

CREATE POLICY "Profiles UPDATE" ON profiles FOR UPDATE USING (
  public.get_my_role() = 'sys_admin' OR
  id = auth.uid() OR
  (public.get_my_role() = 'company_admin' AND company_id = public.get_my_company_id())
);

-- ==========================
-- orders
-- ==========================
CREATE POLICY "Orders SELECT" ON orders FOR SELECT USING (
  public.get_my_role() = 'sys_admin' OR
  public.get_my_role() = 'company_admin' OR
  (public.get_my_role() = 'shop_admin' AND shop_id = public.get_my_shop_id())
);

CREATE POLICY "Orders ALL" ON orders FOR ALL USING (
  public.get_my_role() = 'sys_admin' OR
  (public.get_my_role() = 'shop_admin' AND shop_id = public.get_my_shop_id())
);

-- ==========================
-- assignments
-- ==========================
CREATE POLICY "Assignments SELECT" ON assignments FOR SELECT USING (
  public.get_my_role() = 'sys_admin' OR
  (public.get_my_role() = 'company_admin' AND public.is_my_company_staff(staff_id)) OR
  (public.get_my_role() = 'shop_admin' AND shop_id = public.get_my_shop_id() AND status != 'draft') OR
  (staff_id = auth.uid() AND status != 'draft')
);

CREATE POLICY "Assignments ALL" ON assignments FOR ALL USING (
  public.get_my_role() = 'sys_admin' OR
  (public.get_my_role() = 'company_admin' AND public.is_my_company_staff(staff_id))
);
