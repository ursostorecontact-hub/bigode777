
-- Recreate the view with SECURITY INVOKER (default in newer PG, explicit for clarity)
DROP VIEW IF EXISTS public.team_members;

CREATE VIEW public.team_members
  WITH (security_invoker = true)
  AS SELECT id, full_name FROM public.profiles WHERE active = true;

GRANT SELECT ON public.team_members TO authenticated;
