-- DispatchPRO Database Initialization Script
-- (Please copy and paste this entire code into the Supabase SQL Editor and click "Run")

-- 1. Create Core Tables
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  color_theme text DEFAULT 'bg-blue-100',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('sys_admin', 'company_admin', 'shop_admin', 'staff')),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
  name text NOT NULL,
  daily_salary int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE shop_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  business_type text NOT NULL,
  daily_rate int NOT NULL,
  UNIQUE(shop_id, business_type)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  business_type text NOT NULL,
  requested_count int DEFAULT 0,
  UNIQUE(target_date, shop_id, business_type)
);

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  staff_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  business_type text NOT NULL,
  report_items jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'reported', 'approved')),
  notes text,
  UNIQUE(target_date, staff_id) -- A staff member can only have 1 assignment per day
);

-- 2. Mock Data Seeding (初期データ)
INSERT INTO companies (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Sample 派遣株式会社') ON CONFLICT DO NOTHING;
INSERT INTO shops (id, name, color_theme) VALUES ('22222222-2222-2222-2222-222222222222', '新宿店', 'bg-blue-100') ON CONFLICT DO NOTHING;
INSERT INTO shops (id, name, color_theme) VALUES ('33333333-3333-3333-3333-333333333333', '渋谷店', 'bg-green-100') ON CONFLICT DO NOTHING;

-- 3. Temporarily enable open Row Level Security (RLS) for prototype testing
-- (Security policies will be tightened mapped to Roles later)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access inside companies" ON companies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access inside shops" ON shops FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access inside profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE shop_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access inside shop_rates" ON shop_rates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access inside orders" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access inside assignments" ON assignments FOR ALL USING (true) WITH CHECK (true);
