import { supabase, isSupabaseConfigured, createEphemeralSupabaseClient } from '../lib/supabaseClient';
import { Profile, UserRole, ActivityLog, Teacher } from '../types/database.types';
import { DEMO_USERS, DEMO_TEACHERS } from '../lib/demoData';
import { academicService } from './academicService';
import { activityLogService } from './activityLogService';

export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  roles: UserRole[];
  teacher_info?: {
    id: string;
    nip: string | null;
    specialization: string | null;
  } | null;
  // Detail kredensial dan sinkronisasi data guru
  password?: string;
  title_prefix?: string | null;
  title_suffix?: string | null;
  gender?: 'L' | 'P';
  nip?: string | null;
  nuptk?: string | null;
  specialization?: string | null;
}

export interface CreateUserData {
  email: string;
  full_name: string;
  phone_number?: string;
  password?: string;
  roles: UserRole[];
  teacher_id?: string;
  // Detail data guru untuk otomatisasi integrasi
  auto_create_teacher?: boolean;
  title_prefix?: string;
  title_suffix?: string;
  nip?: string;
  nuptk?: string;
  gender?: 'L' | 'P';
  specialization?: string;
  is_active?: boolean;
}

export interface BulkImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  createdUsers: UserListItem[];
}

// Local persistence storage key for users
const USERS_STORAGE_KEY = 'simpel_users_cache_v2';

export function getDemoUsers(): UserListItem[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading stored users:', e);
  }

  const initial: UserListItem[] = DEMO_USERS.map((du) => ({
    id: du.id,
    email: du.profile.email,
    full_name: du.profile.full_name,
    phone_number: du.profile.phone_number,
    avatar_url: du.profile.avatar_url,
    is_active: du.profile.is_active,
    created_at: du.profile.created_at,
    roles: du.roles,
    password: du.password || 'AlIhsan2026!',
    title_prefix: null,
    title_suffix: null,
    gender: 'L',
    nip: null,
    nuptk: null,
    specialization: 'Administrator Sistem',
    teacher_info: du.teacherId
      ? {
          id: du.teacherId,
          nip: DEMO_TEACHERS.find((t) => t.id === du.teacherId)?.nip || null,
          specialization: DEMO_TEACHERS.find((t) => t.id === du.teacherId)?.specialization || null,
        }
      : null,
  }));

  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
  } catch {}

  return initial;
}

export function saveDemoUsers(users: UserListItem[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Error saving stored users:', e);
  }
}

export async function fetchUsersList(filters?: {
  search?: string;
  role?: string;
  status?: string;
}): Promise<UserListItem[]> {
  const localUsers = getDemoUsers();
  const mergedByEmail = new Map<string, UserListItem>();

  for (const lu of localUsers) {
    mergedByEmail.set(lu.email.trim().toLowerCase(), lu);
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, email, full_name, phone_number, avatar_url, is_active, created_at,
          user_roles (role),
          teachers (id, nip, nuptk, specialization, gender, title_prefix, title_suffix)
        `)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data as any[]) {
          const normEmail = String(row.email || '').trim().toLowerCase();
          if (!normEmail) continue;
          const existingLocal = mergedByEmail.get(normEmail);
          const remoteRoles: UserRole[] = (row.user_roles || []).map((r: any) => r.role);
          const teacher = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;

          mergedByEmail.set(normEmail, {
            id: row.id,
            email: normEmail,
            full_name: row.full_name || existingLocal?.full_name || normEmail.split('@')[0],
            phone_number: row.phone_number ?? existingLocal?.phone_number ?? null,
            avatar_url: row.avatar_url ?? existingLocal?.avatar_url ?? null,
            is_active: row.is_active ?? existingLocal?.is_active ?? true,
            created_at: row.created_at || existingLocal?.created_at || new Date().toISOString(),
            roles: remoteRoles.length > 0 ? remoteRoles : existingLocal?.roles || ['guru'],
            password: existingLocal?.password || '••••••••',
            title_prefix: teacher?.title_prefix ?? existingLocal?.title_prefix ?? null,
            title_suffix: teacher?.title_suffix ?? existingLocal?.title_suffix ?? null,
            gender: teacher?.gender ?? existingLocal?.gender ?? 'L',
            nip: teacher?.nip ?? existingLocal?.nip ?? null,
            nuptk: teacher?.nuptk ?? existingLocal?.nuptk ?? null,
            specialization: teacher?.specialization ?? existingLocal?.specialization ?? null,
            teacher_info: teacher
              ? { id: teacher.id, nip: teacher.nip, specialization: teacher.specialization }
              : existingLocal?.teacher_info ?? null,
          });
        }
      } else if (error) {
        console.warn('Supabase fetchUsersList fallback to local store:', error.message);
      }
    } catch (err) {
      console.warn('Supabase query error, fallback to local store:', err);
    }
  }

  let result = Array.from(mergedByEmail.values());

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.nip && u.nip.toLowerCase().includes(q)) ||
        (u.specialization && u.specialization.toLowerCase().includes(q))
    );
  }

  if (filters?.role) {
    result = result.filter((u) => u.roles.includes(filters.role as UserRole));
  }

  if (filters?.status === 'active') {
    result = result.filter((u) => u.is_active);
  } else if (filters?.status === 'inactive') {
    result = result.filter((u) => !u.is_active);
  }

  return result;
}

export async function fetchTeachersWithoutAccount(): Promise<Teacher[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .is('user_id', null)
        .eq('is_active', true);
      if (!error && data && data.length > 0) return data;
      if (error) console.warn('Supabase fetchTeachersWithoutAccount fallback:', error.message);
    } catch (err) {
      console.warn('Supabase fetchTeachersWithoutAccount error:', err);
    }
  }

  const allTeachers = await academicService.getTeachers();
  const existingUsers = getDemoUsers();
  return allTeachers.filter((t) => !existingUsers.some((u) => u.teacher_info?.id === t.id));
}

/**
 * Membuat Akun Pengguna Baru sekaligus otomatis membuat/menautkan data Tenaga Pendidik (Guru)
 */
export async function createUserWithRoles(data: CreateUserData, adminId: string = 'usr-admin-alihsan'): Promise<UserListItem> {
  if (!data.email || !data.email.trim()) {
    throw new Error('Alamat email / username wajib diisi.');
  }

  if (!data.full_name || !data.full_name.trim()) {
    throw new Error('Nama lengkap wajib diisi.');
  }

  if (data.roles.length === 0) {
    throw new Error('Pilih minimal satu peran untuk akun baru ini.');
  }

  const normalizedEmail = data.email.trim().toLowerCase();
  const currentUsers = getDemoUsers();

  // Cek duplikasi email
  if (currentUsers.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error(`Email "${normalizedEmail}" sudah digunakan oleh akun lain.`);
  }

  const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const password = data.password?.trim() || 'AlIhsan2026!';

  const cleanNip = data.nip?.trim() || undefined;
  const cleanNuptk = data.nuptk?.trim() || undefined;

  // Periksa apakah peran mencakup aspek keguruan / akademik
  const isTeacherRole = data.roles.some((r) => ['guru', 'wali_kelas', 'kepala_madrasah'].includes(r));
  const shouldCreateTeacher = data.auto_create_teacher !== false && (isTeacherRole || !!data.specialization || !!cleanNip);

  let linkedTeacher: Teacher | null = null;

  // Otomatis sinkronisasi ke Data Guru
  if (shouldCreateTeacher) {
    try {
      const existingTeachers = await academicService.getTeachers();
      // Cek apakah data guru dengan NIP atau Nama yang sama sudah ada di tabel guru
      const matchedTeacher = existingTeachers.find(
        (t) =>
          (cleanNip && t.nip === cleanNip) ||
          t.full_name.toLowerCase() === data.full_name.toLowerCase().trim()
      );

      if (matchedTeacher) {
        // Tautkan akun baru ini ke profil guru yang sudah ada
        linkedTeacher = await academicService.updateTeacher(matchedTeacher.id, {
          user_id: newUserId,
          title_prefix: data.title_prefix !== undefined ? data.title_prefix : matchedTeacher.title_prefix,
          title_suffix: data.title_suffix !== undefined ? data.title_suffix : matchedTeacher.title_suffix,
          nip: cleanNip || matchedTeacher.nip,
          nuptk: cleanNuptk || matchedTeacher.nuptk,
          gender: data.gender || matchedTeacher.gender,
          phone_number: data.phone_number || matchedTeacher.phone_number,
          specialization: data.specialization || matchedTeacher.specialization,
          is_active: true,
        });
      } else {
        // Otomatis buat entri data Guru baru
        linkedTeacher = await academicService.createTeacher({
          user_id: newUserId,
          full_name: data.full_name.trim(),
          title_prefix: data.title_prefix || null,
          title_suffix: data.title_suffix || null,
          nip: cleanNip || null,
          nuptk: cleanNuptk || null,
          gender: data.gender || 'L',
          phone_number: data.phone_number || null,
          specialization: data.specialization || (data.roles.includes('kepala_madrasah') ? 'Kepala Madrasah' : 'Guru Pengampu'),
          is_active: true,
        });
      }
    } catch (tchErr) {
      console.warn('Gagal otomatis sinkronisasi guru:', tchErr);
    }
  } else if (data.teacher_id) {
    // Menghubungkan secara manual ke ID guru yang dipilih
    try {
      linkedTeacher = await academicService.updateTeacher(data.teacher_id, {
        user_id: newUserId,
      });
    } catch (tchErr) {
      console.warn('Gagal menghubungkan guru terpilih:', tchErr);
    }
  }

  const newItem: UserListItem = {
    id: newUserId,
    email: normalizedEmail,
    full_name: data.full_name.trim(),
    phone_number: data.phone_number || null,
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    roles: data.roles,
    password,
    title_prefix: data.title_prefix || linkedTeacher?.title_prefix || null,
    title_suffix: data.title_suffix || linkedTeacher?.title_suffix || null,
    gender: data.gender || linkedTeacher?.gender || 'L',
    nip: data.nip || linkedTeacher?.nip || null,
    nuptk: data.nuptk || linkedTeacher?.nuptk || null,
    specialization: data.specialization || linkedTeacher?.specialization || null,
    teacher_info: linkedTeacher
      ? {
          id: linkedTeacher.id,
          nip: linkedTeacher.nip,
          specialization: linkedTeacher.specialization,
        }
      : null,
  };

  const updated = [newItem, ...currentUsers];
  saveDemoUsers(updated);

  // Daftarkan otomatis ke Supabase Auth via client terpisah agar sesi Admin tidak tertimpa
  if (isSupabaseConfigured) {
    const ephemeralClient = createEphemeralSupabaseClient();
    if (ephemeralClient) {
      const safeRoles = data.roles.filter((r) => r !== 'admin');
      void ephemeralClient.auth
        .signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: data.full_name.trim(),
              roles: safeRoles,
            },
          },
        })
        .catch((err) => {
          console.warn('Auto-provision Supabase Auth skipped:', err);
        });
    }
  }

  // Catat ke Log Aktivitas
  await activityLogService.log({
    userId: adminId,
    userName: 'Administrator Madrasah',
    userRole: 'admin',
    action: 'CREATE_USER_AND_TEACHER',
    module: 'Manajemen Akun & Guru',
    details: `Mendaftarkan akun ${newItem.full_name} (${newItem.email}) dengan peran: ${newItem.roles.join(', ')}${linkedTeacher ? ' (Otomatis masuk Data Guru)' : ''}`,
  });

  return newItem;
}

/**
 * Pendaftaran Massal Akun & Guru dari CSV
 */
export async function bulkCreateUsersFromCSV(
  rows: Array<CreateUserData>,
  adminId: string,
  options?: { updateExisting?: boolean }
): Promise<BulkImportResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const createdUsers: UserListItem[] = [];
  const updateExisting = options?.updateExisting ?? false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.email || !row.full_name) {
        throw new Error(`Baris ${i + 1}: Email dan Nama Lengkap wajib diisi.`);
      }

      const normalizedEmail = row.email.trim().toLowerCase();
      const currentUsers = getDemoUsers();
      const existing = currentUsers.find((u) => u.email.trim().toLowerCase() === normalizedEmail);

      if (existing && updateExisting) {
        const updated = await updateUserAndTeacher(existing.id, {
          full_name: row.full_name.trim(),
          email: normalizedEmail,
          phone_number: row.phone_number || existing.phone_number || null,
          password: row.password?.trim() || existing.password || 'AlIhsan2026!',
          roles: row.roles,
          is_active: row.is_active ?? existing.is_active,
          title_prefix: row.title_prefix ?? existing.title_prefix ?? null,
          title_suffix: row.title_suffix ?? existing.title_suffix ?? null,
          nip: row.nip?.trim() || existing.nip || null,
          nuptk: row.nuptk?.trim() || existing.nuptk || null,
          gender: row.gender || existing.gender || 'L',
          specialization: row.specialization || existing.specialization || null,
        });
        createdUsers.push(updated);
        success++;
      } else {
        const created = await createUserWithRoles(row, adminId);
        createdUsers.push(created);
        success++;
      }
    } catch (err: any) {
      failed++;
      errors.push(`Baris ${i + 1} (${row.email || row.full_name || 'Tanpa Nama'}): ${err.message}`);
    }
  }

  return {
    total: rows.length,
    success,
    failed,
    errors,
    createdUsers,
  };
}

/**
 * Memperbarui Akun Pengguna sekaligus menyinkronkan data Guru yang terhubung
 */
export async function updateUserAndTeacher(
  userId: string,
  payload: {
    full_name: string;
    email: string;
    phone_number?: string | null;
    password?: string;
    roles: UserRole[];
    is_active: boolean;
    title_prefix?: string | null;
    title_suffix?: string | null;
    nip?: string | null;
    nuptk?: string | null;
    gender?: 'L' | 'P';
    specialization?: string | null;
  }
): Promise<UserListItem> {
  const currentUsers = getDemoUsers();
  const normalizedTargetEmail = payload.email.toLowerCase().trim();
  const existing =
    currentUsers.find((u) => u.id === userId) ||
    currentUsers.find((u) => u.email.toLowerCase() === normalizedTargetEmail);

  // Sinkronkan ke Data Guru jika terhubung atau memiliki peran pendidik
  let linkedTeacherInfo = existing?.teacher_info || null;
  const isTeacherRole = payload.roles.some((r) => ['guru', 'wali_kelas', 'kepala_madrasah'].includes(r));

  if (existing?.teacher_info?.id) {
    try {
      const updatedTeacher = await academicService.updateTeacher(existing.teacher_info.id, {
        full_name: payload.full_name,
        title_prefix: payload.title_prefix || null,
        title_suffix: payload.title_suffix || null,
        nip: payload.nip || null,
        nuptk: payload.nuptk || null,
        gender: payload.gender || 'L',
        phone_number: payload.phone_number || null,
        specialization: payload.specialization || null,
        is_active: payload.is_active,
      });
      linkedTeacherInfo = {
        id: updatedTeacher.id,
        nip: updatedTeacher.nip,
        specialization: updatedTeacher.specialization,
      };
    } catch (err) {
      console.warn('Gagal sinkronisasi data guru saat update akun:', err);
    }
  } else if (isTeacherRole) {
    // Belum punya profil guru, cari berdasarkan NIP/Nama atau otomatis buatkan
    try {
      const existingTeachers = await academicService.getTeachers();
      const matchedTeacher = existingTeachers.find(
        (t) =>
          (payload.nip && t.nip === payload.nip.trim()) ||
          t.full_name.toLowerCase() === payload.full_name.toLowerCase().trim()
      );
      if (matchedTeacher) {
        const updatedTeacher = await academicService.updateTeacher(matchedTeacher.id, {
          user_id: existing?.id || userId,
          full_name: payload.full_name,
          title_prefix: payload.title_prefix || matchedTeacher.title_prefix,
          title_suffix: payload.title_suffix || matchedTeacher.title_suffix,
          nip: payload.nip || matchedTeacher.nip,
          nuptk: payload.nuptk || matchedTeacher.nuptk,
          gender: payload.gender || matchedTeacher.gender,
          phone_number: payload.phone_number || matchedTeacher.phone_number,
          specialization: payload.specialization || matchedTeacher.specialization,
          is_active: payload.is_active,
        });
        linkedTeacherInfo = {
          id: updatedTeacher.id,
          nip: updatedTeacher.nip,
          specialization: updatedTeacher.specialization,
        };
      } else {
        const newTeacher = await academicService.createTeacher({
          user_id: existing?.id || userId,
          full_name: payload.full_name,
          title_prefix: payload.title_prefix || null,
          title_suffix: payload.title_suffix || null,
          nip: payload.nip || null,
          nuptk: payload.nuptk || null,
          gender: payload.gender || 'L',
          phone_number: payload.phone_number || null,
          specialization: payload.specialization || 'Guru Pengampu',
          is_active: payload.is_active,
        });
        linkedTeacherInfo = {
          id: newTeacher.id,
          nip: newTeacher.nip,
          specialization: newTeacher.specialization,
        };
      }
    } catch (err) {
      console.warn('Gagal otomatisasi profil guru baru saat update:', err);
    }
  }

  const updatedUser: UserListItem = {
    id: existing?.id || userId,
    avatar_url: existing?.avatar_url || null,
    created_at: existing?.created_at || new Date().toISOString(),
    full_name: payload.full_name,
    email: normalizedTargetEmail,
    phone_number: payload.phone_number || null,
    password: payload.password || existing?.password || 'AlIhsan2026!',
    roles: payload.roles,
    is_active: payload.is_active,
    title_prefix: payload.title_prefix || null,
    title_suffix: payload.title_suffix || null,
    gender: payload.gender || 'L',
    nip: payload.nip || null,
    nuptk: payload.nuptk || null,
    specialization: payload.specialization || null,
    teacher_info: linkedTeacherInfo,
  };

  const updatedList = existing
    ? currentUsers.map((u) => (u.id === existing.id ? updatedUser : u))
    : [updatedUser, ...currentUsers];
  saveDemoUsers(updatedList);

  return updatedUser;
}

export async function updateUserRolesAndStatus(
  userId: string,
  roles: UserRole[],
  isActive: boolean
): Promise<void> {
  if (roles.length === 0) {
    throw new Error('Pengguna wajib memiliki minimal satu peran.');
  }

  const currentUsers = getDemoUsers();
  const existing = currentUsers.find((u) => u.id === userId);
  if (!existing) return;

  await updateUserAndTeacher(userId, {
    full_name: existing.full_name,
    email: existing.email,
    phone_number: existing.phone_number,
    password: existing.password,
    roles,
    is_active: isActive,
    title_prefix: existing.title_prefix,
    title_suffix: existing.title_suffix,
    nip: existing.nip,
    nuptk: existing.nuptk,
    gender: existing.gender,
    specialization: existing.specialization,
  });
}

/**
 * Menghapus akun pengguna dan memutuskan tautan guru
 */
export async function deleteUser(userId: string, emailHint?: string): Promise<void> {
  const currentUsers = getDemoUsers();
  const normalizedHint = emailHint?.trim().toLowerCase();
  const user =
    currentUsers.find((u) => u.id === userId) ||
    (normalizedHint ? currentUsers.find((u) => u.email.trim().toLowerCase() === normalizedHint) : undefined);

  if (user && user.email.toLowerCase() === 'alihsansoborejo@gmail.com') {
    throw new Error('Akun Administrator utama madrasah tidak dapat dihapus.');
  }
  if (normalizedHint === 'alihsansoborejo@gmail.com') {
    throw new Error('Akun Administrator utama madrasah tidak dapat dihapus.');
  }

  // Jika memiliki profil guru yang dibuatkan, hapus data gurunya
  if (user?.teacher_info?.id) {
    try {
      await academicService.deleteTeacher(user.teacher_info.id);
    } catch (err) {
      console.warn('Gagal menghapus data guru tertaut:', err);
    }
  }

  const remaining = currentUsers.filter(
    (u) => u.id !== userId && (!normalizedHint || u.email.trim().toLowerCase() !== normalizedHint)
  );
  saveDemoUsers(remaining);

  await activityLogService.log({
    userName: 'Administrator Madrasah',
    userRole: 'admin',
    action: 'DELETE_USER',
    module: 'Manajemen Akun & Guru',
    details: `Menghapus akun ${user?.full_name || normalizedHint || userId} (${user?.email || normalizedHint || '-'}) beserta tautan guru`,
  });
}

export async function fetchRecentActivityLogs(limit: number = 10): Promise<ActivityLog[]> {
  try {
    const logs = await activityLogService.getRecentLogs(limit);
    if (logs.length > 0) {
      return logs.map((l) => ({
        id: l.id,
        user_id: l.userId || 'usr-admin',
        action_name: l.action,
        entity_name: l.module,
        entity_id: l.id,
        details: { description: l.details },
        ip_address: l.ip || '127.0.0.1',
        user_agent: 'SIMPEL Madrasah App',
        created_at: l.timestamp,
        profile: {
          id: l.userId || 'usr-admin',
          full_name: l.userName,
          email: l.userRole === 'admin' ? 'alihsansoborejo@gmail.com' : `${l.userName.toLowerCase().replace(/[^a-z0-9]/g, '')}@alihsan.sch.id`,
          phone_number: null,
          avatar_url: null,
          is_active: true,
          created_at: l.timestamp,
          updated_at: l.timestamp,
        },
      }));
    }
  } catch {}

  return [];
}
