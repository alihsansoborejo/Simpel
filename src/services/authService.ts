import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AuthUser } from '../types/auth.types';
import { Profile, UserRole } from '../types/database.types';
import { DEMO_USERS } from '../lib/demoData';
import { getDemoUsers } from './userService';
import { academicService } from './academicService';

const LOCAL_SESSION_KEY = 'simpel_mi_session_user';

export async function loginWithEmail(email: string, password?: string): Promise<AuthUser> {
  const normalizedInput = email.trim().toLowerCase();

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
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedInput,
        password: password || '',
      });

      if (!authError && authData?.user) {
        const userId = authData.user.id;
        return await fetchFullUserAccount(userId, normalizedInput);
      }
    } catch (supaErr) {
      console.warn('Supabase Auth error, checking dynamic user accounts:', supaErr);
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
    throw new Error('Profil pengguna tidak ditemukan dalam database madrasah.');
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
    throw new Error('Akun Anda belum memiliki penugasan peran (Role). Hubungi admin madrasah.');
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

