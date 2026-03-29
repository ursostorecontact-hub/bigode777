
-- The team_members VIEW with security_invoker keeps triggering RLS warnings.
-- Convert it to a SECURITY DEFINER function that only returns id + full_name of active profiles.
-- This is safe because it only exposes non-sensitive data (id, name).
DROP VIEW IF EXISTS public.team_members;

CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.active = true;
$$;
