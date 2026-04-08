import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  logo_url: string | null;
  max_users: number;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setTenant(null);
      setLoading(false);
      setIsSuperAdmin(false);
      return;
    }

    const fetchTenant = async () => {
      try {
        // Check super admin
        const { data: saData } = await supabase
          .from('super_admins')
          .select('id')
          .eq('email', user.email || '')
          .maybeSingle();
        
        setIsSuperAdmin(!!saData);

        // Get tenant membership
        const { data: membership } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (membership?.tenant_id) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', membership.tenant_id)
            .single();

          if (tenantData) {
            setTenant({
              id: tenantData.id,
              name: tenantData.name,
              slug: tenantData.slug,
              plan: tenantData.plan,
              status: tenantData.status,
              logo_url: tenantData.logo_url,
              max_users: tenantData.max_users,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching tenant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [user]);

  return (
    <TenantContext.Provider value={{ tenant, tenantId: tenant?.id || null, loading, isSuperAdmin }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
