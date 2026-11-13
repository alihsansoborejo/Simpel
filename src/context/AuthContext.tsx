import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { AuthUser } from '../types/auth.types';
import { UserRole } from '../types/database.types';
import {
  loginWithEmail,
  loginDirectlyAs,
  logoutUser,
  getPersistedSession,
  fetchFullUserAccount,
} from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getDemoUsers } from '../services/userService';
import { academicService } from '../services/academicService';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface AuthContextType {
  user: AuthUser | null;
  activeRole: UserRole;
  availableRoles: UserRole[];
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<void>;
  loginAsDemo: (target: 'admin' | 'kamad' | 'guru' | 'pjok') => Promise<void>;
  logout: () => Promise<void>;
  switchActiveRole: (role: UserRole) => void;
  refreshProfile: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => getPersistedSession());
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const session = getPersistedSession();
    return session?.activeRole || 'guru';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inisialisasi sesi awal dan listener Supabase Auth
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            try {
              const fullUser = await fetchFullUserAccount(session.user.id, session.user.email);
              setUser(fullUser);
              setActiveRole(fullUser.activeRole);
            } catch (supaErr) {
              const local = getPersistedSession();
              if (local && mounted) {
                setUser(local);
                setActiveRole(local.activeRole);
              } else {
                throw supaErr;
              }
            }
          } else if (!session) {
            const local = getPersistedSession();
            if (local && mounted) {
              setUser(local);
              setActiveRole(local.activeRole);
            }
          }
        } else {
          // Mode demo / offline fallback
          const local = getPersistedSession();
          if (local && mounted) {
            setUser(local);
            setActiveRole(local.activeRole);
          }
        }
      } catch (err: any) {
        console.warn('Session init warning:', err?.message);
        if (mounted && err?.message) {
          setError(err.message);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    // Listener perubahan auth Supabase jika aktif
    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;
          if (event === 'SIGNED_IN' && session?.user) {
            try {
              const fullUser = await fetchFullUserAccount(session.user.id, session.user.email);
              setUser(fullUser);
              setActiveRole(fullUser.activeRole);
            } catch (err: any) {
              const local = getPersistedSession();
              if (!local) {
                setError(err.message);
              }
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            localStorage.removeItem('simpel_mi_session_user');
          }
        }
      );

      return () => {
        mounted = false;
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedUser = await loginWithEmail(email, password);
      setUser(loggedUser);
      setActiveRole(loggedUser.activeRole);
    } catch (err: any) {
      setError(err?.message || 'Gagal masuk.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async (target: 'admin' | 'kamad' | 'guru' | 'pjok') => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedUser = await loginDirectlyAs(target);
      setUser(loggedUser);
      setActiveRole(loggedUser.activeRole);
    } catch (err: any) {
      setError(err?.message || 'Gagal masuk demo.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchActiveRole = (role: UserRole) => {
    if (!user || !user.roles.includes(role)) {
      console.warn(`User does not have role: ${role}`);
      return;
    }
    setActiveRole(role);
    const updated = { ...user, activeRole: role };
    setUser(updated);
    localStorage.setItem('simpel_mi_session_user', JSON.stringify(updated));
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && session.user.id === user.id) {
          const refreshed = await fetchFullUserAccount(user.id, user.email);
          setUser(refreshed);
          return;
        }
      }

      const latestUsers = getDemoUsers();
      const matched = latestUsers.find(
        (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
      );

      const resolvedName = matched?.full_name || user.profile.full_name;
      const resolvedTeacher = await academicService.resolveTeacherForUser({
        id: matched?.id || user.id,
        email: matched?.email || user.email,
        profile: { full_name: resolvedName },
        teacherId: matched?.teacher_info?.id || user.teacherId || null,
      });

      const teacherId = resolvedTeacher?.id || matched?.teacher_info?.id || user.teacherId || null;
      const hrClass = await academicService.resolveHomeroomClassForUser(
        {
          id: matched?.id || user.id,
          email: matched?.email || user.email,
          profile: { full_name: resolvedName },
          teacherId,
          homeroomClassId: user.homeroomClassId,
        },
        resolvedTeacher
      );
      const homeroomClassId = hrClass?.id || null;

      const nextRoles = matched && matched.roles.length > 0 ? matched.roles : user.roles;
      const nextActiveRole = nextRoles.includes(activeRole) ? activeRole : nextRoles[0];

      const updated: AuthUser = {
        ...user,
        profile: {
          ...user.profile,
          full_name: resolvedName,
          phone_number: matched ? matched.phone_number : user.profile.phone_number,
          avatar_url: matched ? matched.avatar_url : user.profile.avatar_url,
          is_active: matched ? matched.is_active : user.profile.is_active,
        },
        roles: nextRoles,
        activeRole: nextActiveRole,
        teacherId,
        homeroomClassId,
      };

      setActiveRole(nextActiveRole);
      setUser(updated);
      localStorage.setItem('simpel_mi_session_user', JSON.stringify(updated));
    } catch (err: any) {
      console.warn('Gagal memuat ulang profil:', err?.message);
    }
  };

  useRealtimeSync(
    ['simpel_users_cache_v2', 'simpel_teachers', 'simpel_classes', 'simpel_homeroom_assignments', 'simpel_assignments'],
    () => {
      void refreshProfile();
    }
  );

  const availableRoles = useMemo(() => user?.roles || [], [user]);

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        availableRoles,
        isLoading,
        error,
        login,
        loginAsDemo,
        logout,
        switchActiveRole,
        refreshProfile,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};
