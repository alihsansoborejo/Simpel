import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AppNotification, NotificationCategory, UserRole } from '../types/database.types';

const NOTIFICATIONS_STORAGE_KEY = 'simpel_app_notifications_v1';

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    target_role: 'semua',
    category: 'pengumuman',
    title: 'Selamat Datang di SIMPEL MI AL IHSAN v2.1',
    message: 'Aplikasi Manajemen Pembelajaran resmi MI Ma’arif Al Ihsan Soborejo telah siap untuk operasional madrasah.',
    action_url: 'dashboard',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif-2',
    target_role: 'guru',
    category: 'presensi',
    title: 'Pengingat Presensi Siswa Harian',
    message: 'Mohon pastikan kehadiran siswa hari ini telah tercatat sebelum pukul 10.00 WIB.',
    action_url: 'presensi',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'notif-3',
    target_role: 'guru',
    category: 'jurnal',
    title: 'Pengingat Pengisian Jurnal Mengajar',
    message: 'Catat progres materi KBM, capaian Deep Learning, dan respon peserta didik pada tabel jurnal.',
    action_url: 'jurnal-mengajar',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'notif-4',
    target_role: 'guru',
    category: 'dokumen',
    title: 'Pengingat Kelengkapan Modul Ajar',
    message: 'Bapak/Ibu Guru dimohon menyelesaikan pengunggahan Modul Ajar dan LKPD ke Google Drive madrasah.',
    action_url: 'arsip-drive',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'notif-5',
    target_role: 'guru',
    category: 'supervisi',
    title: 'Jadwal Supervisi Akademik & KBM',
    message: 'Supervisi pembelajaran klinis oleh Kepala Madrasah dijadwalkan pekan depan. Siapkan instrumen modul ajar.',
    action_url: 'supervisi-guru',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'notif-6',
    target_role: 'kepala_madrasah',
    category: 'tindak_lanjut_supervisi',
    title: 'Pemberitahuan: Telaah Modul Ajar Baru Diajukan',
    message: 'Terdapat draf modul ajar yang diajukan oleh guru pengampu untuk diperiksa dan disahkan.',
    action_url: 'arsip-drive',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'notif-7',
    target_role: 'wali_kelas',
    category: 'nilai',
    title: 'Pengingat Pengawasan Nilai & Rapor',
    message: 'Periksa kelengkapan nilai sumatif lingkup materi siswa kelas binaan Anda untuk persiapan olah rapor.',
    action_url: 'monitoring-nilai-mapel',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'notif-8',
    target_role: 'admin',
    category: 'akademik',
    title: 'Audit Keamanan & Penugasan Mengajar',
    message: 'Seluruh SK penugasan guru per rombel kelas 1-6 telah terdistribusi pada tahun ajaran aktif.',
    action_url: 'penugasan-guru',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
];

function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

function saveStoredNotifications(items: AppNotification[]) {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save notifications:', err);
  }
}

export const notificationService = {
  async getNotifications(userId?: string, userRole?: UserRole): Promise<AppNotification[]> {
    if (isSupabaseConfigured && userId) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data as AppNotification[];
        }
      } catch (err) {
        console.warn('Supabase notifications fallback:', err);
      }
    }

    const all = getStoredNotifications();
    return all.filter((n) => {
      if (!userRole) return true;
      if (n.target_role === 'semua' || !n.target_role) return true;
      return n.target_role === userRole;
    });
  },

  async markAsRead(id: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch (err) {
        console.warn('Supabase markAsRead fallback:', err);
      }
    }

    const items = getStoredNotifications();
    const idx = items.findIndex((i) => i.id === id);
    if (idx !== -1) {
      items[idx].is_read = true;
      saveStoredNotifications(items);
      return true;
    }
    return false;
  },

  async markAllAsRead(userRole?: UserRole): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      } catch (err) {
        console.warn('Supabase markAllAsRead fallback:', err);
      }
    }

    const items = getStoredNotifications();
    const updated = items.map((i) => {
      if (!userRole || i.target_role === 'semua' || i.target_role === userRole) {
        return { ...i, is_read: true };
      }
      return i;
    });
    saveStoredNotifications(updated);
    return true;
  },

  async addNotification(payload: Omit<AppNotification, 'id' | 'is_read' | 'created_at'>): Promise<AppNotification> {
    const newNotif: AppNotification = {
      ...payload,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notifications').insert(newNotif);
      } catch (err) {
        console.warn('Supabase addNotification fallback:', err);
      }
    }

    const items = getStoredNotifications();
    items.unshift(newNotif);
    saveStoredNotifications(items);
    return newNotif;
  },
};
