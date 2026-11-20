export type KoKurikulerSubMenu =
  | 'perencanaan'
  | 'bahan-ajar'
  | 'asesmen'
  | 'administrasi';

export interface KoKurikulerItem {
  id: string;
  sub_menu: KoKurikulerSubMenu;
  teacher_id: string;
  teacher_user_id?: string;
  recorder_email?: string;
  teacher_name: string;
  class_level: number; // 0 = Lintas Kelas (Semua Rombel), 1..6 = Kelas tertentu
  class_name: string;
  semester: 'Ganjil' | 'Genap';
  academic_year: string;
  theme_or_dimension: string;
  title: string;
  description: string;
  target_participants?: string;
  allocated_hours?: number;
  activity_date?: string;
  file_id?: string;
  file_name?: string;
  google_drive_url?: string;
  folder_path?: string;
  curriculum_doc_id?: string;
  status: 'Draft' | 'Diajukan' | 'Disetujui' | 'Perlu Revisi';
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KoKurikulerSubMenuMeta {
  key: KoKurikulerSubMenu;
  viewId: string;
  label: string;
  shortLabel: string;
  description: string;
  driveCategory: string;
  driveFolder: string;
  defaultTheme: string;
}

export const KOKURIKULER_SUBMENUS: KoKurikulerSubMenuMeta[] = [
  {
    key: 'perencanaan',
    viewId: 'kokurikuler-perencanaan',
    label: 'Perencanaan dan Modul',
    shortLabel: 'Perencanaan & Modul',
    description:
      'Program kokurikuler, pemetaan dimensi profil & pembiasaan madrasah, jadwal pelaksanaan, serta modul proyek/kegiatan kokurikuler.',
    driveCategory: 'Ko Kurikuler - Perencanaan dan Modul',
    driveFolder: '09. Ko Kurikuler - Perencanaan dan Modul',
    defaultTheme: 'Penguatan Karakter & Pembiasaan Islami',
  },
  {
    key: 'bahan-ajar',
    viewId: 'kokurikuler-bahan-ajar',
    label: 'Bahan Ajar dan Aktivitas Murid',
    shortLabel: 'Bahan Ajar & Aktivitas',
    description:
      'Materi pengayaan kokurikuler, panduan praktik lapangan, lembar aktivitas murid, dan media kegiatan kokurikuler.',
    driveCategory: 'Ko Kurikuler - Bahan Ajar dan Aktivitas Murid',
    driveFolder: '10. Ko Kurikuler - Bahan Ajar dan Aktivitas Murid',
    defaultTheme: 'Aktivitas Kolaboratif & Karya Murid',
  },
  {
    key: 'asesmen',
    viewId: 'kokurikuler-asesmen',
    label: 'Asesmen dan Refleksi',
    shortLabel: 'Asesmen & Refleksi',
    description:
      'Rubrik capaian kokurikuler (BB/MB/BSH/SB), instrumen observasi sikap, catatan perkembangan, dan refleksi murid serta guru.',
    driveCategory: 'Ko Kurikuler - Asesmen dan Refleksi',
    driveFolder: '11. Ko Kurikuler - Asesmen dan Refleksi',
    defaultTheme: 'Rubrik Observasi & Refleksi Karakter',
  },
  {
    key: 'administrasi',
    viewId: 'kokurikuler-administrasi',
    label: 'Administrasi dan Pelaporan',
    shortLabel: 'Administrasi & Pelaporan',
    description:
      'Daftar hadir peserta didik, berita acara kegiatan, dokumentasi, rekap capaian, serta laporan pelaksanaan kokurikuler.',
    driveCategory: 'Ko Kurikuler - Administrasi dan Pelaporan',
    driveFolder: '12. Ko Kurikuler - Administrasi dan Pelaporan',
    defaultTheme: 'Pelaporan & Dokumentasi Kegiatan',
  },
];
