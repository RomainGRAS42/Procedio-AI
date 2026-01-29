-- FIX: Make Manager check case-insensitive
-- The previous check for 'MANAGER' might have failed if the DB has 'Manager' or 'manager'

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND role ILIKE 'manager' -- ILIKE makes it case-insensitive
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
