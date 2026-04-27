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
