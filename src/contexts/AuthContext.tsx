import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  // Tracks the auth user ID that currently has its role loaded, to detect real user changes.
  const loadedUserIdRef = useRef<string | null>(null);

  const clearAuthState = useCallback(() => {
    loadedUserIdRef.current = null;
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
      if (!roleRes.data && !roleRes.error) {
        console.warn('[AuthContext] No role row found for user_id:', userId,
          '– check that user_roles table has a record with this user_id.');
      }

      setProfile(profileRes.data ?? null);
      setRole((roleRes.data?.role as UserRole | undefined) ?? null);
      loadedUserIdRef.current = userId;
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
        // Defer-fetch only when the role for this user hasn't been loaded yet.
        // If signIn() or restoreValidatedSession() already fetched it, skip to
        // avoid a second network call that could overwrite a valid role with null
        // on transient failure.
        if (loadedUserIdRef.current !== currentUser.id) {
          // Show loading so ProtectedRoute doesn't render the sidebar with role=null.
          setLoading(true);
          setTimeout(() => {
            if (!mounted) return;
            // Re-check inside the callback: signIn() may have loaded it in the meantime.
            if (loadedUserIdRef.current !== currentUser.id) {
              fetchProfileAndRole(currentUser.id).finally(() => {
                if (mounted) setLoading(false);
              });
            } else {
              setLoading(false);
            }
          }, 0);
        }
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
    // Remove manually any remaining Supabase keys that signOut({ scope: 'local' })
    // may not have cleared (e.g. corrupted entries left by a paused project).
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Não foi possível iniciar a sessão');

    // Eagerly fetch profile and role right after authentication so the sidebar
    // renders correctly before the onAuthStateChange deferred callback fires.
    await fetchProfileAndRole(data.user.id);
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
