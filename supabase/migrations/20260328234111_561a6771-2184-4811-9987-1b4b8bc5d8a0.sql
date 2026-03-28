-- Fix overly permissive policies

-- Fix leads INSERT: require assigned_to or admin/manager
DROP POLICY "Authenticated insert leads" ON public.leads;
CREATE POLICY "Authenticated insert leads" ON public.leads FOR INSERT TO authenticated 
  WITH CHECK (assigned_to = auth.uid() OR assigned_to IS NULL OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Fix clients INSERT: require authenticated
DROP POLICY "Insert clients" ON public.clients;
CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Fix clients UPDATE
DROP POLICY "Update clients" ON public.clients;
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));