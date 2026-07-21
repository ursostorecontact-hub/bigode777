import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  tenant: Tenant | null; // a empresa própria de verdade do usuário
  tenantId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  // "Portal central": super admin pode entrar em outra empresa pra visualizar/gerenciar
  activeTenant: Tenant | null; // a empresa sendo EXIBIDA agora (pode ser outra, se estiver "entrado")
  activeTenantId: string | null;
  isImpersonating: boolean;
  enterTenant: (tenantId: string) => Promise<void>;
  exitImpersonation: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);
const IMPERSONATION_KEY = 'flashcrms_impersonating_tenant_id';

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(
    () => sessionStorage.getItem(IMPERSONATION_KEY)
  );

  const fetchTenantById = useCallback(async (id: string): Promise<Tenant | null> => {
    const { data } = await supabase.from('tenants').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id, name: data.name, slug: data.slug, plan: data.plan,
      status: data.status, logo_url: data.logo_url, max_users: data.max_users,
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setTenant(null);
      setActiveTenant(null);
      setLoading(false);
      setIsSuperAdmin(false);
      return;
    }

    const fetchTenant = async () => {
      try {
        const { data: saData } = await supabase
          .from('super_admins')
          .select('id')
          .eq('email', user.email || '')
          .maybeSingle();
        const superAdmin = !!saData;
        setIsSuperAdmin(superAdmin);

        const { data: membership } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        let ownTenant: Tenant | null = null;
        if (membership?.tenant_id) {
          ownTenant = await fetchTenantById(membership.tenant_id);
          setTenant(ownTenant);
        }

        // Se for super admin e tiver escolhido "entrar" em outra empresa antes,
        // mostra essa empresa em vez da própria — senão, mostra a própria normalmente.
        if (superAdmin && impersonatingId) {
          const other = await fetchTenantById(impersonatingId);
          if (other) {
            setActiveTenant(other);
          } else {
            // empresa não existe mais / id inválido — volta pro normal
            sessionStorage.removeItem(IMPERSONATION_KEY);
            setImpersonatingId(null);
            setActiveTenant(ownTenant);
          }
        } else {
          setActiveTenant(ownTenant);
        }
      } catch (err) {
        console.error('Error fetching tenant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [user, impersonatingId, fetchTenantById]);

  const enterTenant = useCallback(async (tenantId: string) => {
    sessionStorage.setItem(IMPERSONATION_KEY, tenantId);
    setImpersonatingId(tenantId);
    // Recarrega a página inteira — garante que TODAS as telas/consultas peguem
    // a empresa nova do zero, sem cache antigo misturado.
    window.location.href = '/dashboard';
  }, []);

  const exitImpersonation = useCallback(() => {
    sessionStorage.removeItem(IMPERSONATION_KEY);
    setImpersonatingId(null);
    window.location.href = '/superadmin';
  }, []);

  const isImpersonating = !!impersonatingId && activeTenant?.id !== tenant?.id;

  return (
    <TenantContext.Provider value={{
      tenant,
      tenantId: tenant?.id || null,
      loading,
      isSuperAdmin,
      activeTenant,
      activeTenantId: activeTenant?.id || null,
      isImpersonating,
      enterTenant,
      exitImpersonation,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
