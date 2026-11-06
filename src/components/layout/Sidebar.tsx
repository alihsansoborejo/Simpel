import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  Award,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  FolderSync,
  HeartHandshake,
  LogOut,
  X,
  School,
  Database,
  TrendingUp,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { activeRole, logout } = useAuth();

  // Definisi navigasi terkurasi per peran
  const getNavItems = (): { section: string; items: MenuItem[] }[] => {
    switch (activeRole) {
      case 'admin':
        return [
          {
            section: 'UTAMA',
            items: [
              { id: 'dashboard', label: 'Dashboard Admin', icon: LayoutDashboard },
              { id: 'kelola-pengguna', label: 'Kelola Pengguna & Peran', icon: Users, badge: 'Tahap 3' },
            ],
          },
          {
            section: 'DATA MASTER',
            items: [
              { id: 'master-guru', label: 'Data Guru & Staf', icon: GraduationCap },
              { id: 'master-siswa', label: 'Data Siswa (NISN)', icon: Users },
              { id: 'master-kelas', label: 'Kelas 1 s.d. 6', icon: School },
              { id: 'master-mapel', label: 'Mata Pelajaran', icon: BookOpen },
              { id: 'penugasan-guru', label: 'Penugasan Mengajar (SK)', icon: ClipboardList },
              { id: 'pengaturan-akademik', label: 'Tahun Ajaran & KKTP', icon: Database },
            ],
          },
          {
            section: 'AUDIT & KEAMANAN',
            items: [
              { id: 'log-aktivitas', label: 'Log Aktivitas Sistem', icon: ClipboardList },
            ],
          },
        ];

      case 'kepala_madrasah':
        return [
          {
            section: 'MANAJERIAL',
            items: [
              { id: 'dashboard', label: 'Dashboard Eksekutif', icon: LayoutDashboard },
              { id: 'supervisi-kbm', label: 'Supervisi Akademik & KBM', icon: Award, badge: 'Formulir' },
              { id: 'arsip-drive', label: 'Telaah Dokumen Kurikulum', icon: FolderSync },
              { id: 'monitoring-kbm', label: 'Monitoring Jurnal & Presensi', icon: ClipboardList },
            ],
          },
          {
            section: 'AKADEMIK & RAPOR',
            items: [
              { id: 'pengawasan-nilai', label: 'Pengawasan Nilai Siswa', icon: Award },
              { id: 'analisis-nilai', label: 'Analisis Hasil Belajar', icon: TrendingUp },
              { id: 'pengesahan-rapor', label: 'Pengesahan & Kunci Rapor', icon: CheckCircle2 },
              { id: 'laporan-madrasah', label: 'Laporan Mutu Akademik', icon: FileSpreadsheet },
            ],
          },
        ];

      case 'wali_kelas':
        return [
          {
            section: 'KELAS BINAAN',
            items: [
              { id: 'dashboard', label: 'Dashboard Wali Kelas', icon: LayoutDashboard },
              { id: 'siswa-kelas', label: 'Daftar Siswa Kelas', icon: Users },
              { id: 'monitoring-nilai-mapel', label: 'Monitoring Nilai Mapel', icon: Award },
              { id: 'rekap-presensi-kelas', label: 'Rekap Presensi Rombel', icon: CalendarCheck },
            ],
          },
          {
            section: 'PENGOLAHAN RAPOR',
            items: [
              { id: 'catatan-perkembangan', label: 'Catatan Karakter Siswa', icon: FileText },
              { id: 'pengolahan-rapor', label: 'Olah & Cetak Rapor', icon: FileSpreadsheet },
            ],
          },
        ];

      case 'guru':
      default:
        return [
          {
            section: 'PEMBELAJARAN',
            items: [
              { id: 'dashboard', label: 'Dashboard Guru', icon: LayoutDashboard },
              { id: 'presensi', label: 'Presensi Siswa Harian', icon: CalendarCheck },
              { id: 'jurnal-mengajar', label: 'Jurnal Mengajar Harian', icon: ClipboardList },
            ],
          },
          {
            section: 'PERANGKAT AJAR',
            items: [
              { id: 'arsip-drive', label: 'Arsip Dokumen Drive', icon: FolderSync },
              { id: 'asisten-ai', label: 'Asisten AI Gemini', icon: Sparkles, badge: 'Cerdas' },
            ],
          },
          {
            section: 'PENILAIAN & BIMBINGAN',
            items: [
              { id: 'asesmen-nilai', label: 'Input Nilai Siswa', icon: Award },
              { id: 'remedial-pengayaan', label: 'Remedial & Pengayaan', icon: FileSpreadsheet },
              { id: 'analisis-nilai', label: 'Analisis Hasil Belajar', icon: TrendingUp },
              { id: 'bimbingan-siswa', label: 'Bimbingan Siswa (BK)', icon: HeartHandshake },
            ],
          },
        ];
    }
  };

  const navSections = getNavItems();

  const handleItemClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Backdrop Mobile */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 flex flex-col w-64 h-screen bg-slate-900 text-slate-200 border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="flex items-center justify-between h-16 px-5 bg-emerald-900/80 border-b border-emerald-800/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-700 text-amber-300 font-extrabold text-lg shadow-inner">
              IH
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
                SIMPEL MI AL IHSAN
              </h1>
              <p className="text-[10px] text-emerald-200 font-medium">MI Ma’arif Al Ihsan Soborejo</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {sec.section}
              </p>
              <div className="space-y-0.5 mt-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-400 text-slate-900">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Info & Logout */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800">
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>
    </>
  );
};
