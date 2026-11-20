import {
  supabase,
  isSupabaseConfigured,
  isSupabaseAvailable,
  reportSupabaseOutcome,
  detectSupabaseQuotaError,
  createEphemeralSupabaseClient,
} from '../lib/supabaseClient';
import { AuthUser } from '../types/auth.types';
import { Profile, UserRole } from '../types/database.types';
import { DEMO_USERS } from '../lib/demoData';
import { getDemoUsers, sortRolesByPriority } from './userService';
import { academicService } from './academicService';
import { syncService } from './syncService';

const LOCAL_SESSION_KEY = 'simpel_mi_session_user';
let lastSupabaseAuthError: string | null = null;

export function getLastSupabaseAuthError(): string | null {
  return lastSupabaseAuthError;
}

export async function signInSupabaseStrict(email: string, password: string): Promise<AuthUser> {
  if (!isSupabaseConfigured) {
    throw new Error('Variabel VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY belum diatur.');
  }
  const normalizedInput = email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedInput,
    password: password || '',
  });
  reportSupabaseOutcome(authError);
  if (authError) {
    lastSupabaseAuthError = authError.message;
    if (detectSupabaseQuotaError(authError)) {
      throw new Error(
        'Layanan database & autentikasi Supabase sedang dibatasi kuota (exceed_egress_quota). Silakan masuk melalui sesi aplikasi lokal terlebih dahulu atau cek kuota pada dashboard Supabase.'
      );
    }
    const msgLower = authError.message.toLowerCase();
    if (msgLower.includes('email not confirmed')) {
      throw new Error(
        'Email belum dikonfirmasi di Supabase Auth. Buka Supabase → Authentication → Users, konfirmasi email atau buat ulang dengan Auto Confirm User dicentang.'
      );
    }
    if (msgLower.includes('invalid login credentials')) {
      throw new Error(
        'Email atau kata sandi belum cocok di Supabase Auth. Pastikan user sudah dibuat di Supabase → Authentication → Users dan kata sandinya sama.'
      );
    }
    throw new Error(`Login Supabase gagal: ${authError.message}`);
  }
  if (!authData?.user) {
    throw new Error('Sesi Supabase Auth tidak terbentuk.');
  }
  lastSupabaseAuthError = null;
  const fullUser = await fetchFullUserAccount(authData.user.id, normalizedInput);
  void syncService.syncAllLocalToCloud();
  return fullUser;
}

function findMatchedAppUser(normalizedInput: string) {
  const dynamicUsers = getDemoUsers();
  return (
    dynamicUsers.find((u) => {
      const uEmail = u.email.toLowerCase();
      return (
        uEmail === normalizedInput ||
        (normalizedInput.includes('alihsan') && uEmail.includes('alihsan')) ||
        (normalizedInput === 'admin' && u.roles.includes('admin'))
      );
    }) ||
    DEMO_USERS.find((u) => u.email.toLowerCase() === normalizedInput) ||
    (normalizedInput === 'alihsansoborejo@gmail.com' ? DEMO_USERS[0] : undefined)
  );
}

export async function loginWithEmail(email: string, password?: string): Promise<AuthUser> {
  const normalizedInput = email.trim().toLowerCase();
  lastSupabaseAuthError = null;

  // Cari dari daftar seluruh akun yang tersinkron di Manajemen Akun & Guru
  let matchedUser = findMatchedAppUser(normalizedInput);

  // Jika perangkat lain baru saja dibuatkan akun oleh Admin dan belum sempat sinkron, paksa tarik state terbaru dulu
  if (!matchedUser) {
    try {
      await syncService.pullFromServer(0, { priorityFast: true });
      if (isSupabaseAvailable()) {
        await syncService.pullFromSupabaseCloud({ fastOnly: true, hydrateLocalServer: true });
      }
      matchedUser = findMatchedAppUser(normalizedInput);
    } catch {
      // ignore network error during refresh attempt
    }
  }

  if (isSupabaseAvailable()) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedInput,
        password: password || '',
      });
      reportSupabaseOutcome(authError);

      if (!authError && authData?.user) {
        try {
          const fullUser = await fetchFullUserAccount(authData.user.id, normalizedInput);
          void syncService.syncAllLocalToCloud();
          return fullUser;
        } catch (profileErr) {
          if (!matchedUser) throw profileErr;
          console.warn('Supabase profile incomplete, using synced app registry:', profileErr);
        }
      }

      if (authError) {
        lastSupabaseAuthError = authError.message;
        const msgLower = authError.message.toLowerCase();
        // Jika user ada di Supabase Auth tapi belum konfirmasi email, beri info jelas
        if (msgLower.includes('email not confirmed') && !matchedUser) {
          throw new Error(
            'Email belum dikonfirmasi di Supabase Auth. Buka Supabase → Authentication → Users lalu konfirmasi email.'
          );
        }
      }
    } catch (supaErr: any) {
      reportSupabaseOutcome(supaErr);
      lastSupabaseAuthError = supaErr?.message || 'Supabase Auth fallback';
      console.warn('Supabase Auth error, checking app user registry:', supaErr);
    }
  }

  // Verifikasi lintas server via Supabase Cloud RPC jika akun berasal dari app_sync_state atau belum ada lokal
  const rawStoredPass = matchedUser && 'password' in matchedUser ? (matchedUser as any).password : undefined;
  const isStoredMasked =
    !rawStoredPass || rawStoredPass === '__CLOUD_VERIFIED__' || rawStoredPass === '••••••••';
  const needsCloudRpcVerify = isSupabaseAvailable() && (!matchedUser || isStoredMasked);
  let cloudRpcFailedReason: 'none' | 'quota_exceeded' | 'unavailable' = 'none';

  if (needsCloudRpcVerify) {
    try {
      const { data: cloudAuth, error: rpcErr } = await supabase.rpc('verify_app_user_login', {
        p_email: normalizedInput,
        p_password: password?.trim() || '',
      });
      reportSupabaseOutcome(rpcErr);
      if (rpcErr) {
        cloudRpcFailedReason = detectSupabaseQuotaError(rpcErr) ? 'quota_exceeded' : 'unavailable';
      }
      if (!rpcErr && cloudAuth) {
        if (cloudAuth.ok && cloudAuth.user) {
          const cu = cloudAuth.user;
          const syncedMatch = findMatchedAppUser(String(cu.email || normalizedInput).trim().toLowerCase());
          const rawRoles: UserRole[] =
            syncedMatch?.roles && syncedMatch.roles.length > 0
              ? syncedMatch.roles
              : Array.isArray(cu.roles) && cu.roles.length > 0
                ? cu.roles
                : ['guru'];
          const roles = sortRolesByPriority(rawRoles);
          const resolvedTeacher = await academicService.resolveTeacherForUser({
            id: cu.id,
            email: cu.email,
            profile: { full_name: cu.full_name },
            teacherId: cu.teacher_id || null,
          });
          const resolvedTeacherId = cu.teacher_id || resolvedTeacher?.id || null;
          let homeroomClassId: string | null = cu.homeroom_class_id || null;
          if (!homeroomClassId) {
            const hrCls = await academicService.resolveHomeroomClassForUser(
              {
                id: cu.id,
                email: cu.email,
                profile: { full_name: cu.full_name },
                teacherId: resolvedTeacherId,
              },
              resolvedTeacher
            );
            homeroomClassId = hrCls?.id || null;
          }
          const cloudProfile: Profile = {
            id: cu.id,
            email: cu.email,
            full_name: cu.full_name,
            phone_number: cu.phone_number || null,
            avatar_url: null,
            is_active: cu.is_active ?? true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const authUser: AuthUser = {
            id: cu.id,
            email: cu.email,
            profile: cloudProfile,
            roles,
            activeRole: roles[0],
            teacherId: resolvedTeacherId,
            homeroomClassId,
          };
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
          return authUser;
        }
        if (cloudAuth.reason === 'inactive') {
          throw new Error(`Akun "${email}" berstatus nonaktif. Silakan hubungi Administrator Madrasah.`);
        }
        if (cloudAuth.reason === 'invalid_password') {
          throw new Error('Kata sandi yang Anda masukkan salah.');
        }
      }
    } catch (cloudErr: any) {
      if (
        cloudErr?.message?.includes('Kata sandi') ||
        cloudErr?.message?.includes('nonaktif')
      ) {
        throw cloudErr;
      }
      // RPC belum tersedia atau kuota terbatasi; lanjutkan fallback lokal
      if (detectSupabaseQuotaError(cloudErr)) {
        cloudRpcFailedReason = 'quota_exceeded';
      } else if (cloudRpcFailedReason === 'none') {
        cloudRpcFailedReason = 'unavailable';
      }
    }
  }

  // Jika tidak ditemukan akun yang cocok
  if (!matchedUser) {
    throw new Error(
      `Email "${email}" belum terdaftar. Pastikan akun telah didaftarkan melalui panel Administrator dan perangkat terhubung ke server.`
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
  const expectedPassword = !isStoredMasked ? rawStoredPass : 'AlIhsan2026!';
  if (password && password.trim() !== expectedPassword) {
    if (isStoredMasked) {
      throw new Error(
        cloudRpcFailedReason === 'quota_exceeded' || !isSupabaseAvailable()
          ? 'Koneksi database cloud (Supabase) sedang terbatasi kuota sehingga verifikasi sandi terenkripsi cloud tidak terjangkau. Minta Admin Madrasah menyetel ulang kata sandi akun ini di menu Manajemen Akun & Guru.'
          : 'Kata sandi yang Anda masukkan salah, atau minta Admin Madrasah menyetel ulang kata sandi di menu Manajemen Akun & Guru.'
      );
    }
    throw new Error('Kata sandi yang Anda masukkan salah.');
  }

  // Jika akun guru/wali kelas terdaftar di Manajemen Akun & Guru dan Supabase aktif,
  // coba daftarkan otomatis di latar belakang (berhasil langsung bila Confirm Email OFF di Supabase)
  if (isSupabaseAvailable() && matchedUser.email.toLowerCase() !== 'alihsansoborejo@gmail.com') {
    const eph = createEphemeralSupabaseClient();
    if (eph) {
      const nonAdminRoles = matchedUser.roles.filter((r) => r !== 'admin');
      const fullName =
        'full_name' in matchedUser
          ? matchedUser.full_name
          : (matchedUser as any).profile?.full_name || matchedUser.email.split('@')[0];
      void eph.auth
        .signUp({
          email: matchedUser.email.toLowerCase(),
          password: password || expectedPassword,
          options: { data: { full_name: fullName, roles: nonAdminRoles } },
        })
        .catch(() => {});
    }
  }

  // Cari keterkaitan wali kelas dan guru
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

  const initialTeacherId =
    ('teacher_info' in matchedUser && (matchedUser as any).teacher_info?.id) ||
    ('teacherId' in matchedUser ? (matchedUser as any).teacherId : undefined);

  const resolvedTeacher = await academicService.resolveTeacherForUser({
    id: matchedUser.id,
    email: matchedUser.email,
    profile: { full_name: profile.full_name },
    teacherId: initialTeacherId || null,
  });
  const teacherId = resolvedTeacher?.id || initialTeacherId || null;

  let homeroomClassId: string | null = null;
  try {
    const hrCls = await academicService.resolveHomeroomClassForUser(
      {
        id: matchedUser.id,
        email: matchedUser.email,
        profile: { full_name: profile.full_name },
        teacherId,
      },
      resolvedTeacher
    );
    homeroomClassId = hrCls?.id || null;
  } catch (err) {
    console.warn('Error reading homeroom class during login:', err);
  }

  const sortedRoles = sortRolesByPriority(matchedUser.roles);
  const authUser: AuthUser = {
    id: matchedUser.id,
    email: matchedUser.email,
    profile,
    roles: sortedRoles,
    activeRole: sortedRoles[0],
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

  if (isSupabaseAvailable() && matchedUser?.email) {
    try {
      const candidatePassword =
        ('password' in matchedUser && (matchedUser as any).password) || 'AlIhsan2026!';
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: matchedUser.email.toLowerCase(),
        password: candidatePassword,
      });
      reportSupabaseOutcome(authError);
      if (!authError && authData?.user) {
        return await fetchFullUserAccount(authData.user.id, matchedUser.email.toLowerCase());
      }
      if (authError) {
        lastSupabaseAuthError = authError.message;
        console.warn('Supabase Auth quick login fallback to local session:', authError.message);
      }
    } catch (supaErr: any) {
      reportSupabaseOutcome(supaErr);
      lastSupabaseAuthError = supaErr?.message || 'Quick login fallback';
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

  const sortedRoles = sortRolesByPriority(matchedUser.roles);
  const preferredActiveRole: UserRole =
    target === 'kamad' && sortedRoles.includes('kepala_madrasah')
      ? 'kepala_madrasah'
      : sortedRoles[0];

  const authUser: AuthUser = {
    id: matchedUser.id,
    email: matchedUser.email,
    profile,
    roles: sortedRoles,
    activeRole: preferredActiveRole,
    teacherId,
    homeroomClassId,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
  return authUser;
}

export async function fetchFullUserAccount(userId: string, emailFallback?: string): Promise<AuthUser> {
  // 1. Ambil data profil
  let { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  const isPermissionDenied =
    profileError?.code === '42501' ||
    Boolean(profileError?.message && /permission denied/i.test(profileError.message));

  if (isPermissionDenied) {
    throw new Error(
      'Izin akses tabel PostgreSQL (GRANT) di proyek Supabase baru belum aktif (42501 permission denied). Salin & jalankan ulang Skrip SQL Lengkap terbaru (atau skrip GRANT) di Supabase SQL Editor.'
    );
  }

  const isMissingTableError =
    profileError?.code === '42P01' ||
    profileError?.code === 'PGRST205' ||
    Boolean(profileError?.message && /does not exist|schema cache/i.test(profileError.message));

  if (isMissingTableError) {
    throw new Error(
      'Tabel public.profiles belum ada di proyek Supabase aktif saat ini. Buka SQL Editor di dashboard proyek Supabase baru Anda, jalankan seluruh skrip SQL migrasi, lalu coba hubungkan kembali.'
    );
  }

  // Jika tabel sudah ada tetapi baris profil user belum terbentuk, coba pulihkan otomatis lewat RPC
  if (!profileData) {
    try {
      await supabase.rpc('ensure_current_user_profile');
      const retryRes = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      profileData = retryRes.data;
      profileError = retryRes.error;
    } catch {
      // ignore if RPC does not exist yet
    }
  }

  if (profileError || !profileData) {
    throw new Error(
      'Profil pengguna belum ada di tabel public.profiles. Pastikan skrip SQL migrasi terbaru sudah dijalankan hingga selesai (Success) di Supabase SQL Editor proyek baru Anda.'
    );
  }

  const profile: Profile = profileData;

  if (!profile.is_active) {
    throw new Error('Akun Anda saat ini dinonaktifkan oleh administrator madrasah.');
  }

  // 2. Ambil peran pengguna dari user_roles
  let { data: rolesData, error: rolesError } = await supabase
    .from('user_roles')
    .select('role, is_primary')
    .eq('user_id', userId);

  if (!rolesError && (!rolesData || rolesData.length === 0)) {
    try {
      await supabase.rpc('ensure_current_user_profile');
      const retryRoles = await supabase
        .from('user_roles')
        .select('role, is_primary')
        .eq('user_id', userId);
      rolesData = retryRoles.data;
      rolesError = retryRoles.error;
    } catch {
      // ignore
    }
  }

  if (rolesError || !rolesData || rolesData.length === 0) {
    throw new Error(
      'Akun Supabase Auth berhasil masuk, tetapi peran (role) di tabel public.user_roles masih kosong. Salin & jalankan ulang Skrip SQL Lengkap terbaru di Supabase SQL Editor.'
    );
  }

  const supabaseRoles: UserRole[] = rolesData.map((r: { role: UserRole }) => r.role);
  const resolvedEmail = (profile.email || emailFallback || '').trim().toLowerCase();
  const syncedAppUser = resolvedEmail
    ? getDemoUsers().find((u) => u.email.trim().toLowerCase() === resolvedEmail)
    : undefined;

  const combinedRoles = new Set<UserRole>(
    syncedAppUser?.roles && syncedAppUser.roles.length > 0 ? syncedAppUser.roles : supabaseRoles
  );
  if (supabaseRoles.includes('admin') || resolvedEmail === 'alihsansoborejo@gmail.com') {
    combinedRoles.add('admin');
  }
  const roles = sortRolesByPriority(Array.from(combinedRoles));

  // 3. Cari teacher_id dan homeroom_class_id jika terdaftar sebagai guru/wali kelas
  let teacherId: string | null = null;
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (teacherData) {
    teacherId = teacherData.id;
  }

  const resolvedTeacher = await academicService.resolveTeacherForUser({
    id: userId,
    email: profile.email || emailFallback || '',
    profile: { full_name: profile.full_name },
    teacherId,
  });
  teacherId = teacherId || resolvedTeacher?.id || null;

  const resolvedHomeroom = await academicService.resolveHomeroomClassForUser(
    {
      id: userId,
      email: profile.email || emailFallback || '',
      profile: { full_name: profile.full_name },
      teacherId,
    },
    resolvedTeacher
  );

  // Peran aktif: pertahankan pilihan peran user sebelumnya jika masih sah dan tidak baru mendapat peran Kepala Madrasah;
  // jika belum ada sesi atau baru mendapat peran Kepala Madrasah, aktifkan peran prioritas tertinggi.
  const persisted = getPersistedSession();
  const isSamePersistedUser = Boolean(
    persisted &&
      (persisted.id === userId || (resolvedEmail && persisted.email.trim().toLowerCase() === resolvedEmail))
  );
  const newlyGrantedPrincipal = Boolean(
    isSamePersistedUser && !persisted!.roles.includes('kepala_madrasah') && roles.includes('kepala_madrasah')
  );
  const primaryRoleEntry = rolesData.find((r: { is_primary: boolean }) => r.is_primary);
  const defaultRole: UserRole = roles.includes('kepala_madrasah')
    ? 'kepala_madrasah'
    : primaryRoleEntry && roles.includes(primaryRoleEntry.role)
      ? primaryRoleEntry.role
      : roles[0];

  const activeRole: UserRole = newlyGrantedPrincipal
    ? 'kepala_madrasah'
    : isSamePersistedUser && roles.includes(persisted!.activeRole)
      ? persisted!.activeRole
      : defaultRole;

  const authUser: AuthUser = {
    id: userId,
    email: profile.email || emailFallback || '',
    profile,
    roles,
    activeRole,
    teacherId,
    homeroomClassId: resolvedHomeroom?.id || null,
  };

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authUser));
  return authUser;
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore remote signout errors so local logout always succeeds
    }
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

  if (isSupabaseAvailable()) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    reportSupabaseOutcome(error);
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
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();
      reportSupabaseOutcome(error);

      if (!error && data) {
        const current = getPersistedSession();
        if (current && current.id === userId) {
          current.profile = { ...current.profile, ...data };
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(current));
        }
        return data;
      }
    } catch (err) {
      reportSupabaseOutcome(err);
      console.warn('Supabase updateUserProfile fallback ke lokal:', err);
    }
  }

  // Update local session & synced user registry
  const current = getPersistedSession();
  if (current && current.id === userId) {
    current.profile = { ...current.profile, ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(current));
    try {
      const rawUsers = localStorage.getItem('simpel_users_cache_v2');
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          const next = parsed.map((u: any) => (u.id === userId ? { ...u, ...updates } : u));
          localStorage.setItem('simpel_users_cache_v2', JSON.stringify(next));
        }
      }
    } catch {
      // ignore cache sync error
    }
    return current.profile;
  }

  throw new Error('Pengguna tidak ditemukan.');
}

export async function changePassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal harus 6 karakter.');
  }

  if (isSupabaseAvailable()) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      reportSupabaseOutcome(error);
      if (error && !detectSupabaseQuotaError(error)) {
        throw new Error(`Gagal mengubah kata sandi: ${error.message}`);
      }
    } catch (err: any) {
      reportSupabaseOutcome(err);
      if (!detectSupabaseQuotaError(err)) throw err;
    }
  }

  // Pastikan password di registry lokal tersinkron juga agar mode server lokal konsisten
  const current = getPersistedSession();
  if (current) {
    try {
      const rawUsers = localStorage.getItem('simpel_users_cache_v2');
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          const next = parsed.map((u: any) =>
            u.id === current.id || String(u.email || '').toLowerCase() === current.email.toLowerCase()
              ? { ...u, password: newPassword }
              : u
          );
          localStorage.setItem('simpel_users_cache_v2', JSON.stringify(next));
        }
      }
    } catch {
      // ignore
    }
  }
}

