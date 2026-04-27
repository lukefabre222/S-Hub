-- profilesテーブルにsort_orderカラムを追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 既存のデータに対して、作成日順で連番を振る
WITH NumberedProfiles AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.profiles
)
UPDATE public.profiles
SET sort_order = NumberedProfiles.rn
FROM NumberedProfiles
WHERE public.profiles.id = NumberedProfiles.id;
