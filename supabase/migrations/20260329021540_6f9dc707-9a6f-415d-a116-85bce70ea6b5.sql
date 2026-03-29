
-- Drop the overly broad policy
DROP POLICY "Anyone can read profiles" ON public.profiles;

-- Users can always read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admins and managers can read all profiles
CREATE POLICY "Admins managers read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create a view for minimal profile info (salespeople need names for assignment UIs)
CREATE OR REPLACE VIEW public.team_members AS
  SELECT id, full_name FROM public.profiles WHERE active = true;

-- Grant access to the view
GRANT SELECT ON public.team_members TO authenticated;
