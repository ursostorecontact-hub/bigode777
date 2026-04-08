
-- Create tenant plans enum
CREATE TYPE public.tenant_plan AS ENUM ('basico', 'pro', 'enterprise');
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'trial');
CREATE TYPE public.tenant_member_role AS ENUM ('owner', 'admin', 'member');

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan tenant_plan NOT NULL DEFAULT 'basico',
  status tenant_status NOT NULL DEFAULT 'trial',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tenant_members table
CREATE TABLE public.tenant_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Create super_admins table
CREATE TABLE public.super_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert the super admin
INSERT INTO public.super_admins (email) VALUES ('ursostorecontact@gmail.com');

-- Add tenant_id to existing tables
ALTER TABLE public.leads ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.interactions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_chats ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_instances ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_assignments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.automations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_sources ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.facebook_webhooks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins sa
    JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  )
$$;

-- Enable RLS on new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Members read own tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = current_tenant_id() OR is_super_admin());

CREATE POLICY "Super admins manage all tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "Owners update own tenant" ON public.tenants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Tenant members policies
CREATE POLICY "Members read own tenant members" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin());

CREATE POLICY "Tenant admins manage members" ON public.tenant_members
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM public.tenant_members tm 
      WHERE tm.tenant_id = tenant_members.tenant_id 
      AND tm.user_id = auth.uid() 
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Super admins - only super admins can read
CREATE POLICY "Super admins read super_admins" ON public.super_admins
  FOR SELECT TO authenticated
  USING (is_super_admin());

-- Allow public insert to tenants for registration (will be done via edge function instead)
CREATE POLICY "Public can create tenants via registration" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Allow users to insert themselves as tenant members
CREATE POLICY "Users insert own membership" ON public.tenant_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update updated_at trigger for tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX idx_tasks_tenant_id ON public.tasks(tenant_id);
