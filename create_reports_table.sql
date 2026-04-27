-- 1. reports テーブルの作成
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(target_date, staff_id)
);

-- リアルタイム同期（削除時など）のため
ALTER TABLE public.reports REPLICA IDENTITY FULL;

-- 2. RLSの有効化
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. 安全なヘルパー関数群 (再帰防止のため SECURITY DEFINER を使用)

-- 【閲覧権限】
-- sys_admin: 全て閲覧可
-- company_admin: 自社のスタッフの報告を閲覧可
-- shop_admin: 自店舗への報告を閲覧可
-- staff: 自身の報告のみ閲覧可
CREATE OR REPLACE FUNCTION public.can_read_report(target_staff_id uuid, target_shop_id uuid) RETURNS boolean AS $$
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
    RETURN caller_shop = target_shop_id;
  END IF;

  IF caller_role = 'staff' THEN
    RETURN auth.uid() = target_staff_id;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 【編集権限】
-- sys_admin: 全て編集可
-- staff: 自身の報告のみ編集可
CREATE OR REPLACE FUNCTION public.can_write_report(target_staff_id uuid) RETURNS boolean AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF caller_role = 'sys_admin' THEN RETURN true; END IF;
  RETURN auth.uid() = target_staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. ポリシーの設定
DROP POLICY IF EXISTS "Reports SELECT" ON public.reports;
DROP POLICY IF EXISTS "Reports INSERT" ON public.reports;
DROP POLICY IF EXISTS "Reports UPDATE" ON public.reports;
DROP POLICY IF EXISTS "Reports DELETE" ON public.reports;

CREATE POLICY "Reports SELECT" ON public.reports FOR SELECT USING ( public.can_read_report(staff_id, shop_id) );
CREATE POLICY "Reports INSERT" ON public.reports FOR INSERT WITH CHECK ( public.can_write_report(staff_id) );
CREATE POLICY "Reports UPDATE" ON public.reports FOR UPDATE USING ( public.can_write_report(staff_id) ) WITH CHECK ( public.can_write_report(staff_id) );
CREATE POLICY "Reports DELETE" ON public.reports FOR DELETE USING ( public.can_write_report(staff_id) );
