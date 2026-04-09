import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types/crm';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.error) {
        console.error('Error fetching profile:', profileRes.error);
      }
      if (roleRes.error) {
        console.error('Error fetching role:', roleRes.error);
      }

      setProfile(profileRes.data ?? null);
      setRole((roleRes.data?.role as UserRole | undefined) ?? null);
    } catch (err) {
      console.error('Error fetching profile/role:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const restoreValidatedSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          clearAuthState();
          return;
        }

        const { data: userRes, error: userError } = await supabase.auth.getUser();
        if (userError || !userRes.user) {
          console.warn('Invalid stored session detected, clearing local auth state.');
          await supabase.auth.signOut({ scope: 'local' });
          if (!mounted) return;
          clearAuthState();
          return;
        }

        setUser(userRes.user);
        await fetchProfileAndRole(userRes.user.id);
      } catch (err) {
        console.error('Error restoring session:', err);
        await supabase.auth.signOut({ scope: 'local' });
        if (mounted) clearAuthState();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setTimeout(() => {
          if (mounted) fetchProfileAndRole(currentUser.id);
        }, 0);
      } else {
        clearAuthState();
      }
    });

    restoreValidatedSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuthState, fetchProfileAndRole]);

  const signIn = async (email: string, password: string) => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore stale local-session cleanup failures before a fresh login.
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Não foi possível iniciar a sessão');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
