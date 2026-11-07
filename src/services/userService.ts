import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Profile, UserRole, ActivityLog, Teacher } from '../types/database.types';
import { DEMO_USERS, DEMO_TEACHERS } from '../lib/demoData';

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
}

export interface CreateUserData {
  email: string;
  full_name: string;
  phone_number?: string;
  password?: string;
  roles: UserRole[];
  teacher_id?: string;
}

// Local persistence storage key for demo users
const USERS_STORAGE_KEY = 'simpel_users_cache_v2';

function getDemoUsers(): UserListItem[] {
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

function saveDemoUsers(users: UserListItem[]) {
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
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id, email, full_name, phone_number, avatar_url, is_active, created_at,
          user_roles (role),
          teachers (id, nip, specialization)
        `)
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      if (filters?.status === 'active') {
        query = query.eq('is_active', true);
      } else if (filters?.status === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const items: UserListItem[] = data.map((row: any) => {
          const roles: UserRole[] = (row.user_roles || []).map((r: any) => r.role);
          const teacher = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
          return {
            id: row.id,
            email: row.email,
            full_name: row.full_name,
            phone_number: row.phone_number,
            avatar_url: row.avatar_url,
            is_active: row.is_active,
            created_at: row.created_at,
            roles,
            teacher_info: teacher ? { id: teacher.id, nip: teacher.nip, specialization: teacher.specialization } : null,
          };
        });

        if (filters?.role) {
          return items.filter((u) => u.roles.includes(filters.role as UserRole));
        }

        return items;
      }

      if (error) {
        console.warn('Supabase fetchUsersList fallback to local demo store:', error.message);
      }
    } catch (err) {
      console.warn('Supabase query error, fallback to local store:', err);
    }
  }

  // Fallback demo filtering
  let result = getDemoUsers();

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
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

  return DEMO_TEACHERS.filter((t) => !getDemoUsers().some((u) => u.teacher_info?.id === t.id));
}

export async function createUserWithRoles(data: CreateUserData, adminId: string): Promise<UserListItem> {
  if (data.roles.length === 0) {
    throw new Error('Pilih minimal satu peran untuk akun baru ini.');
  }

  if (isSupabaseConfigured) {
    try {
      // Memanggil backend server / Edge Function via RPC atau Auth Invite
      const { data: result, error } = await supabase.rpc('admin_create_user_with_roles', {
        p_email: data.email,
        p_full_name: data.full_name,
        p_phone: data.phone_number || null,
        p_roles: data.roles,
        p_teacher_id: data.teacher_id || null,
      });

      if (!error && result) {
        return result;
      }
      console.warn('Supabase admin_create_user_with_roles fallback:', error?.message);
    } catch (err) {
      console.warn('Supabase createUserWithRoles error, fallback to local store:', err);
    }
  }

  // Demo Mode Creation
  const newId = `usr-new-${Date.now()}`;
  const newItem: UserListItem = {
    id: newId,
    email: data.email.toLowerCase(),
    full_name: data.full_name,
    phone_number: data.phone_number || null,
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    roles: data.roles,
    teacher_info: data.teacher_id
      ? {
          id: data.teacher_id,
          nip: DEMO_TEACHERS.find((t) => t.id === data.teacher_id)?.nip || null,
          specialization: DEMO_TEACHERS.find((t) => t.id === data.teacher_id)?.specialization || null,
        }
      : null,
  };

  const currentUsers = getDemoUsers();
  const updated = [newItem, ...currentUsers];
  saveDemoUsers(updated);
  return newItem;
}

export async function updateUserRolesAndStatus(
  userId: string,
  roles: UserRole[],
  isActive: boolean
): Promise<void> {
  if (roles.length === 0) {
    throw new Error('Pengguna wajib memiliki minimal satu peran.');
  }

  if (isSupabaseConfigured) {
    try {
      // 1. Update status di profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (!profileError) {
        // 2. Refresh roles di user_roles
        await supabase.from('user_roles').delete().eq('user_id', userId);

        const inserts = roles.map((r, idx) => ({
          user_id: userId,
          role: r,
          is_primary: idx === 0,
        }));

        const { error: rolesError } = await supabase.from('user_roles').insert(inserts);
        if (!rolesError) return;
        console.warn('Supabase insert user_roles error:', rolesError.message);
      } else {
        console.warn('Supabase update profile error:', profileError.message);
      }
    } catch (err) {
      console.warn('Supabase updateUserRolesAndStatus error:', err);
    }
  }

  // Update in demo store
  const currentUsers = getDemoUsers();
  const updated = currentUsers.map((u) => {
    if (u.id === userId) {
      return {
        ...u,
        is_active: isActive,
        roles,
      };
    }
    return u;
  });
  saveDemoUsers(updated);
}

export async function fetchRecentActivityLogs(limit: number = 10): Promise<ActivityLog[]> {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('activity_logs')
      .select('*, profile:profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  // Demo logs
  return [
    {
      id: 'log-1',
      user_id: 'usr-admin',
      action_name: 'UPDATE_ROLES',
      entity_name: 'user_roles',
      entity_id: 'usr-guru-1',
      details: { role_added: 'wali_kelas', class: 'Kelas 4' },
      ip_address: '127.0.0.1',
      user_agent: 'Chrome/126 (Windows NT 10)',
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      profile: {
        id: 'usr-admin',
        full_name: 'Admin SIMPEL MI Al Ihsan',
        email: 'admin@alihsan.sch.id',
        phone_number: null,
        avatar_url: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    },
    {
      id: 'log-2',
      user_id: 'usr-kamad',
      action_name: 'REVIEW_DOCUMENT',
      entity_name: 'document_reviews',
      entity_id: 'doc-001',
      details: { status: 'Disetujui', title: 'Modul Ajar Fikih Bab 2' },
      ip_address: '127.0.0.1',
      user_agent: 'Chrome/126 (Windows NT 10)',
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      profile: {
        id: 'usr-kamad',
        full_name: 'Drs. H. Ahmad Ihsan, M.Pd.I',
        email: 'kamad@alihsan.sch.id',
        phone_number: null,
        avatar_url: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    },
    {
      id: 'log-3',
      user_id: 'usr-guru-1',
      action_name: 'SUBMIT_ATTENDANCE',
      entity_name: 'student_attendance',
      entity_id: 'cls-4',
      details: { class_name: 'Kelas 4', total_present: 27, sick: 1 },
      ip_address: '127.0.0.1',
      user_agent: 'Mobile Safari/17.4 (iPhone)',
      created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      profile: {
        id: 'usr-guru-1',
        full_name: 'Ust. Ahmad Fauzi, S.Pd.I',
        email: 'guru@alihsan.sch.id',
        phone_number: null,
        avatar_url: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    },
  ];
}
