import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AuthUser } from '../types/auth.types';
import { Profile, UserRole } from '../types/database.types';
import { DEMO_USERS } from '../lib/demoData';
import { getDemoUsers } from './userService';
import { academicService } from './academicService';

const LOCAL_SESSION_KEY = 'simpel_mi_session_user';
let lastSupabaseAuthError: string | null = null;

export function getLastSupabaseAuthError(): string | null {
  return lastSupabaseAuthError;
}

export async function loginWithEmail(email: string, password?: string): Promise<AuthUser> {
  const normalizedInput = email.trim().toLowerCase();
  lastSupabaseAuthError = null;

  // Cari dari daftar seluruh akun yang dibuat atau master
  const dynamicUsers = getDemoUsers();
  const matchedUser =
    dynamicUsers.find((u) => {
      const uEmail = u.email.toLowerCase();
      return (
        uEmail === normalizedInput ||
        (normalizedInput.includes('alihsan') && uEmail.includes('alihsan')) ||
        (normalizedInput === 'admin' && u.roles.includes('admin'))
      );
    }) ||
    DEMO_USERS.find((u) => u.email.toLowerCase() === normalizedInput) ||
    (normalizedInput === 'alihsansoborejo@gmail.com' ? DEMO_USERS[0] : undefined);

  if (isSupabaseConfigured) {
    let authData: { user: any } | null = null;
    let authError: { message: string } | null = null;

    try {
      const res = await supabase.auth.signInWithPassword({
        email: normalizedInput,
        password: password || '',
      });
      authData = res.data;
      authError = res.error;
    } catch (networkErr: any) {
      lastSupabaseAuthError = networkErr?.message || 'Gagal menghubungi Supabase Auth.';
      console.warn('Supabase Auth network error, checking local fallback:', networkErr);
    }

    if (authError) {
      lastSupabaseAuthError = authError.message;
      const msgLower = authError.message.toLowerCase();
      if (msgLower.includes('email not confirmed')) {
        throw new Error(
          'Email belum dikonfirmasi di Supabase Auth. Buka Supabase → Authentication → Users, klik user alihsansoborejo@gmail.com lalu konfirmasi email (atau buat ulang dengan Auto Confirm User dicentang).'
        );
      }
      if (msgLower.includes('invalid login credentials')) {
        throw new Error(
          'Email atau kata sandi belum cocok di Supabase Auth. Pastikan user sudah dibuat di Supabase → Authentication → Users (centang Auto Confirm User) dan gunakan kata sandi yang sama.'
        );
      }
      throw new Error(`Login Supabase gagal: ${authError.message}`);
    }

    if (authData?.user) {
      try {
        return await fetchFullUserAccount(authData.user.id, normalizedInput);
      } catch (accountErr: any) {
        lastSupabaseAuthError = accountErr?.message || 'Profil atau role belum tersedia.';
        throw accountErr;
      }
    }
  }

  // Jika tidak ditemukan akun yang cocok
  if (!matchedUser) {
    throw new Error(
      `Email "${email}" belum terdaftar. Pastikan akun telah didaftarkan melalui panel Administrator.`
    );
  }

  // Verifikasi status keaktifan akun
  const isUserActive =
    'is_active' in matchedUser
      ? matchedUser.is_active
      : (matchedUser as any).profile?.is_active ?? true;

  if (!isUserActive) {
    throw new Error(`Akun "${matchedUser.email}" berstatus nonaktif. Silakan hubungi Administrator Madrasah.`);
  }

  // Verifikasi kata sandi akun jika password dimasukkan
  const expectedPassword = ('password' in matchedUser && (matchedUser as any).password) || 'AlIhsan2026!';
  if (password && password.trim() !== expectedPassword && password.trim() !== 'AlIhsan2026!') {
    throw new Error('Kata sandi yang Anda masukkan salah. Kata sandi standar madrasah: AlIhsan2026!');
  }

  // Cari keterkaitan wali kelas dan guru
  let homeroomClassId: string | null = null;
  const teacherId =
    ('teacher_info' in matchedUser && (matchedUser as any).teacher_info?.id) ||
    ('teacherId' in matchedUser ? (matchedUser as any).teacherId : undefined);

  if (teacherId) {
    try {
      const classes = await academicService.getClasses();
      const matchedClass = classes.find((c) => c.homeroom_teacher_id === teacherId);
      if (matchedClass) {
        homeroomClassId = matchedClass.id;
      }
    } catch (err) {
      console.warn('Error reading homeroom class during login:', err);
    }
  }

  const profile: Profile =
    'profile' in matchedUser
      ? (matchedUser as any).profile
      : {
          id: matchedUser.id,
          email: matchedUser.email,
          full_name: matchedUser.full_name,
          phone_number: matchedUser.phone_number,
          avatar_url: matchedUser.avatar_url,
          is_active: matchedUser.is_active,
          created_at: matchedUser.created_at,
          updated_at: matchedUser.created_at,
        };

  const authUser: AuthUser = {
    id: matchedUser.id,
    email: matchedUser.email,
    profile,
    roles: matchedUser.roles,
    activeRole: matchedUser.roles[0],
    teacherId,
    homeroomClassId,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
  return authUser;
}

export async function loginDirectlyAs(target: 'admin' | 'kamad' | 'guru' | 'pjok' = 'admin'): Promise<AuthUser> {
  lastSupabaseAuthError = null;
  const dynamicUsers = getDemoUsers();
  let matchedUser = dynamicUsers.find((u) => {
    if (target === 'admin') return u.roles.includes('admin');
    if (target === 'kamad') return u.roles.includes('kepala_madrasah');
    if (target === 'guru') return u.roles.includes('guru') || u.roles.includes('wali_kelas');
    if (target === 'pjok') return u.specialization?.toLowerCase().includes('pjok') || u.roles.includes('guru');
    return false;
  });

  if (!matchedUser) {
    matchedUser = dynamicUsers[0];
  }

  if (isSupabaseConfigured && matchedUser?.email) {
    const candidatePassword =
      ('password' in matchedUser && (matchedUser as any).password) || 'AlIhsan2026!';
    let authData: { user: any } | null = null;
    let authError: { message: string } | null = null;

    try {
      const res = await supabase.auth.signInWithPassword({
        email: matchedUser.email.toLowerCase(),
        password: candidatePassword,
      });
      authData = res.data;
      authError = res.error;
    } catch (networkErr: any) {
      lastSupabaseAuthError = networkErr?.message || 'Gagal menghubungi Supabase Auth.';
      console.warn('Supabase Auth network error on quick login:', networkErr);
    }

    if (authError) {
      lastSupabaseAuthError = authError.message;
      const msgLower = authError.message.toLowerCase();
      if (msgLower.includes('email not confirmed')) {
        throw new Error(
          'Email alihsansoborejo@gmail.com di Supabase Auth belum terkonfirmasi. Centang "Auto Confirm User" saat membuat user di Supabase Auth → Users.'
        );
      }
      if (msgLower.includes('invalid login credentials')) {
        throw new Error(
          'Login cepat memakai sandi standar (AlIhsan2026!), namun di Supabase Auth akun belum dibuat atau memakai sandi berbeda. Silakan login lewat formulir Email & Sandi di atas.'
        );
      }
      throw new Error(`Autentikasi Supabase gagal: ${authError.message}`);
    }

    if (authData?.user) {
      return await fetchFullUserAccount(authData.user.id, matchedUser.email.toLowerCase());
    }
  }

  let homeroomClassId: string | null = null;
  const teacherId = matchedUser?.teacher_info?.id;
  if (teacherId) {
    try {
      const classes = await academicService.getClasses();
      const matchedClass = classes.find((c) => c.homeroom_teacher_id === teacherId);
      if (matchedClass) homeroomClassId = matchedClass.id;
    } catch {}
  }

  const profile: Profile = {
    id: matchedUser.id,
    email: matchedUser.email,
    full_name: matchedUser.full_name,
    phone_number: matchedUser.phone_number,
    avatar_url: matchedUser.avatar_url,
    is_active: matchedUser.is_active,
    created_at: matchedUser.created_at,
    updated_at: matchedUser.created_at,
  };

  const authUser: AuthUser = {
    id: matchedUser.id,
    email: matchedUser.email,
    profile,
    roles: matchedUser.roles,
    activeRole: matchedUser.roles[0],
    teacherId,
    homeroomClassId,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
  return authUser;
}

export async function fetchFullUserAccount(userId: string, emailFallback?: string): Promise<AuthUser> {
  // 1. Ambil data profil
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    throw new Error(
      'Profil pengguna belum ada di tabel public.profiles. Pastikan skrip SQL migrasi terbaru sudah dijalankan di Supabase SQL Editor.'
    );
  }

  const profile: Profile = profileData;

  if (!profile.is_active) {
    throw new Error('Akun Anda saat ini dinonaktifkan oleh administrator madrasah.');
  }

  // 2. Ambil peran pengguna dari user_roles
  const { data: rolesData, error: rolesError } = await supabase
    .from('user_roles')
    .select('role, is_primary')
    .eq('user_id', userId);

  if (rolesError || !rolesData || rolesData.length === 0) {
    throw new Error(
      'Akun Supabase Auth berhasil masuk, tetapi peran (role) di tabel public.user_roles masih kosong. Salin & jalankan ulang Skrip SQL Lengkap terbaru di Supabase SQL Editor.'
    );
  }

  const roles: UserRole[] = rolesData.map((r: { role: UserRole }) => r.role);

  // 3. Cari teacher_id jika terdaftar sebagai guru
  let teacherId: string | null = null;
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (teacherData) {
    teacherId = teacherData.id;
  }

  // Peran aktif pertama kali: prioritaskan primary role atau role pertama
  const primaryRoleEntry = rolesData.find((r: { is_primary: boolean }) => r.is_primary);
  const activeRole: UserRole = primaryRoleEntry ? primaryRoleEntry.role : roles[0];

  const authUser: AuthUser = {
    id: userId,
    email: profile.email || emailFallback || '',
    profile,
    roles,
    activeRole,
    teacherId,
    homeroomClassId: null,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
  return authUser;
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export function getPersistedSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function requestPasswordReset(email: string): Promise<string> {
  if (!email || !email.includes('@')) {
    throw new Error('Silakan masukkan format alamat email yang valid.');
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      throw new Error(`Gagal mengirim email pemulihan: ${error.message}`);
    }
  }

  return `Tautan pemulihan kata sandi telah dikirimkan ke alamat ${email}. Silakan periksa kotak masuk atau spam email Anda.`;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'phone_number' | 'avatar_url'>>
): Promise<Profile> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Gagal memperbarui profil.');
    }
    return data;
  }

  // Update local session for demo
  const current = getPersistedSession();
  if (current && current.id === userId) {
    current.profile = { ...current.profile, ...updates };
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(current));
    return current.profile;
  }

  throw new Error('Pengguna tidak ditemukan.');
}

export async function changePassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal harus 6 karakter.');
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw new Error(`Gagal mengubah kata sandi: ${error.message}`);
    }
  }
}

