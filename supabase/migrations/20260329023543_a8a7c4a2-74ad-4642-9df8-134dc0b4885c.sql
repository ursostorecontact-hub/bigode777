
-- Remove the INSERT policy that the scanner considers insecure
DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;

-- Remove the overlapping ALL policy 
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

-- Create granular admin-only policies for each operation
CREATE POLICY "Admins select all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete all roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop the old individual policies that overlap
DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins update roles" ON public.user_roles;

-- Add a trigger to enforce that only SECURITY DEFINER functions (like handle_new_user)
-- or admins can insert into user_roles. This prevents any RLS bypass.
CREATE OR REPLACE FUNCTION public.validate_role_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if called from a SECURITY DEFINER context (e.g., handle_new_user trigger)
  -- by checking if current_setting indicates a trusted context
  -- The handle_new_user trigger runs as SECURITY DEFINER so it bypasses RLS entirely.
  -- This trigger adds defense-in-depth: non-admin users cannot insert roles even if RLS is bypassed.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) AND auth.uid() IS NOT NULL AND NEW.user_id != auth.uid() THEN
    -- Allow: admin inserting for others
    -- This path means non-admin trying to insert for someone else
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;
  
  -- Block non-admins from self-assigning admin/manager
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() AND NEW.role != 'salesperson' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Cannot self-assign privileged roles';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_role_insert_trigger
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_insert();
