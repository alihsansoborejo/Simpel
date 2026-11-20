import { Profile, UserRole } from './database.types';

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  roles: UserRole[];
  activeRole: UserRole;
  teacherId?: string | null;
  homeroomClassId?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface RoleConfig {
  key: UserRole;
  label: string;
  badgeColor: string;
  description: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    key: 'admin',
    label: 'Administrator',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Pengelola akun, sistem, dan data master madrasah',
  },
  kepala_madrasah: {
    key: 'kepala_madrasah',
    label: 'Kepala Madrasah',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Supervisi formulir KBM, monitoring jurnal KBM, dan pengesahan rapor',
  },
  guru: {
    key: 'guru',
    label: 'Guru Pengampu',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Perencanaan ajar, jurnal KBM, asesmen, dan asisten AI',
  },
  wali_kelas: {
    key: 'wali_kelas',
    label: 'Wali Kelas',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
    description: 'Presensi siswa rombel asuhan, monitoring rombel, dan pengolahan rapor',
  },
};
