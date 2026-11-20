import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { academicService, getMadrasahSubjectSortRank } from '../../services/academicService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { TeachingAssignment } from '../../types/database.types';
import { KOKURIKULER_SUBMENUS, KoKurikulerSubMenu } from '../../types/kokurikuler.types';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  LifeBuoy,
  HardDrive,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  ClipboardCheck,
  FileArchive,
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
}

interface SidebarSubjectGroup {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectOrderIndex?: number;
  assignments: TeachingAssignment[];
}

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'simpel_sidebar_collapsed_v1';

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  activeView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user, activeRole, logout } = useAuth();
  const { logoUrl, settings } = useAppSettings();
  const { selectedSubjectId, setWorkspaceSelection } = useWorkspace();
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openKoKurikuler, setOpenKoKurikuler] = useState<boolean>(() =>
    activeView.startsWith('kokurikuler')
  );
  const [teacherSubjectGroups, setTeacherSubjectGroups] = useState<SidebarSubjectGroup[]>([]);
  const [isLoadingTeacherMenu, setIsLoadingTeacherMenu] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (activeView.startsWith('kokurikuler')) {
      setOpenKoKurikuler(true);
    }
  }, [activeView]);

  const collapsed = isCollapsed && !isOpenMobile;

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }, []);

  const loadTeacherSubjects = useCallback(async () => {
    if (activeRole !== 'guru' || !user) {
      setTeacherSubjectGroups([]);
      return;
    }
    setIsLoadingTeacherMenu(true);
    try {
      const [teacher, assignments, teachersPool] = await Promise.all([
        academicService.resolveTeacherForUser(user),
        academicService.getTeachingAssignments(),
        academicService.getTeachers(),
      ]);

      const mine = academicService.filterAssignmentsForUser(assignments, user, teacher, teachersPool);

      const groupMap = new Map<string, SidebarSubjectGroup>();
      for (const asg of mine) {
        if (!asg.subject || !asg.class) continue;
        const existing = groupMap.get(asg.subject_id);
        if (existing) {
          existing.assignments.push(asg);
        } else {
          groupMap.set(asg.subject_id, {
            subjectId: asg.subject_id,
            subjectName: asg.subject.name,
            subjectCode: asg.subject.code,
            subjectOrderIndex: asg.subject.order_index,
            assignments: [asg],
          });
        }
      }

      const groups = Array.from(groupMap.values())
        .map((g) => ({
          ...g,
          assignments: g.assignments.sort((a, b) => (a.class?.level || 0) - (b.class?.level || 0)),
        }))
        .sort((a, b) => {
          const rankDiff =
            getMadrasahSubjectSortRank({
              id: a.subjectId,
              code: a.subjectCode,
              name: a.subjectName,
              order_index: a.subjectOrderIndex,
            }) -
            getMadrasahSubjectSortRank({
              id: b.subjectId,
              code: b.subjectCode,
              name: b.subjectName,
              order_index: b.subjectOrderIndex,
            });
          if (rankDiff !== 0) return rankDiff;
          return a.subjectName.localeCompare(b.subjectName, 'id');
        });

      setTeacherSubjectGroups(groups);
      setOpenSubjects((prev) => {
        if (groups.length === 0) return {};
        const hasAnyOpen = groups.some((g) => prev[g.subjectId]);
        if (hasAnyOpen) return prev;
        return { [groups[0].subjectId]: true };
      });
    } catch (err) {
      console.warn('Gagal memuat daftar mapel guru pada sidebar:', err);
    } finally {
      setIsLoadingTeacherMenu(false);
    }
  }, [activeRole, user?.id, user?.email, user?.teacherId, user?.profile?.full_name]);

  useEffect(() => {
    void loadTeacherSubjects();
  }, [loadTeacherSubjects]);

  useRealtimeSync(
    [
      'simpel_assignments',
      'simpel_teachers',
      'simpel_classes',
      'simpel_subjects',
      'simpel_academic_years',
      'simpel_semesters',
      'simpel_users_cache_v2',
      'simpel_mi_lingkup_materi_custom_v1',
      'simpel_mi_lingkup_materi_hidden_v1',
    ],
    () => {
      void loadTeacherSubjects();
    }
  );

  const toggleSubject = (key: string) => {
    setOpenSubjects((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleItemClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  const handleSubjectModuleClick = (view: string, asg: TeachingAssignment) => {
    setWorkspaceSelection({
      subjectId: asg.subject_id,
      classId: asg.class_id,
      classLevel: asg.class?.level || 4,
      assignmentId: asg.id,
    });
    handleItemClick(view);
  };

  // Navigasi untuk Admin, Kepala Madrasah, dan Wali Kelas
  const getNavItems = (): { section: string; items: MenuItem[] }[] => {
    switch (activeRole) {
      case 'admin':
        return [
          {
            section: 'UTAMA',
            items: [
              { id: 'dashboard', label: 'Dashboard Admin', icon: LayoutDashboard },
              { id: 'kelola-pengguna', label: 'Kelola Pengguna & Peran', icon: Users },
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
              { id: 'penyimpanan-drive', label: 'Penyimpanan Google Drive', icon: HardDrive },
              { id: 'migrasi-data', label: 'Pusat Migrasi Data', icon: FileSpreadsheet },
              { id: 'pengaturan-identitas', label: 'Identitas & Logo', icon: School },
              { id: 'pengaturan-akademik', label: 'Tahun Ajaran & KKTP', icon: Database },
            ],
          },
          {
            section: 'MONITORING & PEMBINAAN',
            items: [
              { id: 'kokurikuler-perencanaan', label: 'Monitoring Ko Kurikuler', icon: Compass },
              { id: 'monitoring-kbm', label: 'Monitoring Jurnal KBM', icon: ClipboardList },
              { id: 'supervisi-kbm', label: 'Supervisi Akademik & KBM', icon: Award },
              { id: 'bimbingan-siswa', label: 'Bimbingan Siswa (BK)', icon: HeartHandshake },
            ],
          },
          {
            section: 'AUDIT & OPERASIONAL',
            items: [
              { id: 'lapor-kendala', label: 'Evaluasi & Lapor Kendala', icon: LifeBuoy },
              { id: 'pusat-bantuan', label: 'Pusat Bantuan & Panduan', icon: BookOpen },
              { id: 'log-aktivitas', label: 'Log Aktivitas Sistem', icon: ClipboardList },
              { id: 'asisten-ai', label: 'Asisten AI Gemini', icon: Sparkles },
            ],
          },
        ];

      case 'kepala_madrasah':
        return [
          {
            section: 'MANAJERIAL',
            items: [
              { id: 'dashboard', label: 'Dashboard Eksekutif', icon: LayoutDashboard },
              { id: 'supervisi-kbm', label: 'Supervisi Akademik & KBM', icon: Award },
              { id: 'arsip-drive', label: 'Telaah Dokumen Kurikulum', icon: FolderSync },
              { id: 'penyimpanan-drive', label: 'Penyimpanan Google Drive', icon: HardDrive },
              { id: 'monitoring-kbm', label: 'Monitoring Jurnal KBM', icon: ClipboardList },
              { id: 'kokurikuler-perencanaan', label: 'Monitoring Ko Kurikuler', icon: Compass },
              { id: 'bimbingan-siswa', label: 'Bimbingan Siswa (BK)', icon: HeartHandshake },
            ],
          },
          {
            section: 'AKADEMIK & RAPOR',
            items: [
              { id: 'pengawasan-nilai', label: 'Pengawasan Nilai Siswa', icon: Award },
              { id: 'analisis-nilai', label: 'Analisis Hasil Belajar', icon: TrendingUp },
              { id: 'pengesahan-rapor', label: 'Pengesahan & Kunci Rapor', icon: CheckCircle2 },
              { id: 'laporan-madrasah', label: 'Laporan Mutu Akademik', icon: FileSpreadsheet },
              { id: 'lapor-kendala', label: 'Evaluasi & Lapor Kendala', icon: LifeBuoy },
              { id: 'pusat-bantuan', label: 'Pusat Bantuan SIMPEL', icon: BookOpen },
            ],
          },
          {
            section: 'KECERDASAN BUATAN',
            items: [
              { id: 'asisten-ai-kamad', label: 'AI Asisten Kepala Madrasah', icon: Sparkles },
              { id: 'asisten-ai', label: 'Hub Seluruh Asisten AI', icon: Sparkles },
            ],
          },
        ];

      case 'wali_kelas':
        return [
          {
            section: 'KELAS BINAAN',
            items: [
              { id: 'dashboard', label: 'Dashboard Wali Kelas', icon: LayoutDashboard },
              { id: 'presensi', label: 'Presensi Harian Rombel', icon: CalendarCheck },
              { id: 'siswa-kelas', label: 'Daftar Siswa Kelas', icon: Users },
              { id: 'perangkat-kelas', label: 'Perangkat & Struktur Kelas', icon: ShieldCheck },
              { id: 'monitoring-nilai-mapel', label: 'Monitoring Nilai Mapel', icon: Award },
              { id: 'rekap-presensi-kelas', label: 'Rekap Presensi Rombel', icon: CalendarCheck },
              { id: 'kokurikuler-perencanaan', label: 'Ko Kurikuler Rombel', icon: Compass },
              { id: 'bimbingan-siswa', label: 'Bimbingan Siswa (BK)', icon: HeartHandshake },
            ],
          },
          {
            section: 'PENGOLAHAN RAPOR',
            items: [
              { id: 'catatan-perkembangan', label: 'Catatan Karakter Siswa', icon: FileText },
              { id: 'pengolahan-rapor', label: 'Olah & Cetak Rapor', icon: FileSpreadsheet },
              { id: 'lapor-kendala', label: 'Evaluasi & Kendala', icon: LifeBuoy },
              { id: 'pusat-bantuan', label: 'Pusat Bantuan', icon: BookOpen },
            ],
          },
          {
            section: 'ASISTEN CERDAS',
            items: [
              { id: 'asisten-ai-analisis', label: 'AI Analisis & Narasi Rapor', icon: Sparkles },
              { id: 'asisten-ai', label: 'Asisten AI Gemini', icon: Sparkles },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const navSections = useMemo(() => getNavItems(), [activeRole]);

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
        className={`fixed md:sticky top-0 left-0 z-50 flex flex-col h-screen bg-emerald-950 text-emerald-50 border-r border-emerald-900 transition-[width,transform] duration-200 ease-in-out md:translate-x-0 shrink-0 ${
          collapsed ? 'w-68 md:w-20' : 'w-68'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Tombol Ciutkan / Lebarkan di Tepi Sidebar (Desktop) */}
        <button
          type="button"
          onClick={toggleCollapse}
          title={collapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
          aria-label={collapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-emerald-900 border border-amber-400/50 text-amber-300 hover:bg-amber-400 hover:border-amber-400 hover:text-emerald-950 shadow-md transition-colors absolute -right-3.5 top-4.5 z-20 cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Brand Lockup */}
        <div
          className={`flex items-center h-16 bg-gradient-to-r from-emerald-900 via-emerald-950 to-emerald-900 border-b border-amber-400/30 shrink-0 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <div className={`flex items-center truncate ${collapsed ? 'justify-center' : 'gap-3'}`}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo Madrasah"
                className="w-10 h-10 object-contain rounded-lg shrink-0 p-0.5 bg-emerald-950/60 border border-amber-400/60 shadow-xs"
              />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-emerald-950 font-extrabold text-lg shadow-inner shrink-0 border border-amber-300">
                IH
              </div>
            )}
            {!collapsed && (
              <div className="truncate">
                <h1 className="text-sm font-bold tracking-tight text-amber-50 leading-tight truncate">
                  SIMPEL MI AL IHSAN
                </h1>
                <p className="text-[10px] text-amber-300/90 font-medium truncate">
                  {settings?.school_name || 'MI Ma’arif Al Ihsan Soborejo'}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 rounded-md text-emerald-300 hover:text-amber-300 md:hidden"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Content */}
        <nav className={`flex-1 py-4 space-y-5 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
          {activeRole === 'guru' ? (
            collapsed ? (
              /* Mode Ciut (Ikon Ringkas) untuk Guru */
              <div className="flex flex-col items-center space-y-2">
                <button
                  type="button"
                  onClick={() => handleItemClick('dashboard')}
                  title="Beranda Guru"
                  aria-label="Beranda Guru"
                  className={`flex items-center justify-center w-11 h-10 rounded-lg transition-colors ${
                    activeView === 'dashboard'
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                      : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5" />
                </button>

                {teacherSubjectGroups.length > 0 && (
                  <div className="w-8 border-t border-emerald-800/80 my-1" />
                )}

                {teacherSubjectGroups.map((group) => {
                  const primaryAsg = group.assignments[0];
                  const classLabel = group.assignments
                    .map((a) => a.class?.name?.replace(/^Kelas\s+/i, 'Kls ') || `Kls ${a.class?.level || ''}`)
                    .join(', ');
                  const isCurrentSubjectSelected = selectedSubjectId === group.subjectId;
                  return (
                    <button
                      key={group.subjectId}
                      type="button"
                      onClick={() => {
                        setOpenSubjects((prev) => ({ ...prev, [group.subjectId]: true }));
                        handleSubjectModuleClick('perangkat-pembelajaran', primaryAsg);
                      }}
                      title={`${group.subjectName} (${classLabel})`}
                      aria-label={`${group.subjectName} (${classLabel})`}
                      className={`flex items-center justify-center w-11 h-10 rounded-lg transition-colors ${
                        isCurrentSubjectSelected
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/60'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <Folder className="w-4.5 h-4.5 text-amber-400" />
                    </button>
                  );
                })}

                <div className="w-8 border-t border-emerald-800/80 my-1" />

                {[
                  { id: 'kokurikuler-perencanaan', label: 'Ko Kurikuler', icon: Compass },
                  { id: 'jurnal-mengajar', label: 'Jurnal Mengajar', icon: ClipboardList },
                  { id: 'supervisi-guru', label: 'Riwayat Supervisi', icon: Award },
                  { id: 'penyimpanan-drive', label: 'Penyimpanan Google Drive', icon: HardDrive },
                  { id: 'arsip-drive', label: 'Arsip & Kirim Dokumen (Drive)', icon: FolderSync },
                  { id: 'bimbingan-siswa', label: 'Bimbingan Siswa (BK)', icon: HeartHandshake },
                  { id: 'asisten-ai', label: 'Asisten AI Gemini', icon: Sparkles },
                  { id: 'lapor-kendala', label: 'Lapor Kendala Teknis', icon: LifeBuoy },
                  { id: 'pusat-bantuan', label: 'Pusat Bantuan SIMPEL', icon: BookOpen },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.id === 'supervisi-guru'
                      ? activeView === 'supervisi-guru' || activeView === 'supervisi-kbm'
                      : item.id === 'kokurikuler-perencanaan'
                      ? activeView.startsWith('kokurikuler')
                      : activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      title={item.label}
                      aria-label={item.label}
                      className={`flex items-center justify-center w-11 h-10 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </button>
                  );
                })}
              </div>
            ) : (
              /* =========================================================================
                 STRUKTUR KHUSUS DASHBOR GURU
                 ========================================================================= */
              <div className="space-y-4">
                {/* Grup Utama: DASHBOR GURU */}
                <div>
                  <p className="px-3 text-[10px] font-semibold text-emerald-300/70 uppercase tracking-wider">
                    DASHBOR GURU
                  </p>
                  <div className="mt-1 space-y-1">
                    {/* Dashboard Overview */}
                    <button
                      onClick={() => handleItemClick('dashboard')}
                      className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${
                        activeView === 'dashboard'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <LayoutDashboard className={`w-4 h-4 ${activeView === 'dashboard' ? 'text-emerald-950' : 'text-amber-400'}`} />
                        <span>Beranda Guru</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Hierarki Mata Pelajaran Diampu */}
                <div>
                  <div className="flex items-center justify-between px-3 mb-1.5">
                    <span className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Mata Pelajaran Diampu</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {isLoadingTeacherMenu ? (
                      <div className="px-3 py-2 text-[11px] text-emerald-200/70">
                        Memuat mata pelajaran diampu...
                      </div>
                    ) : teacherSubjectGroups.length === 0 ? (
                      <div className="rounded-xl bg-emerald-900/50 border border-emerald-800/80 p-3 text-[11px] text-emerald-100/80 leading-relaxed">
                        <p className="font-semibold text-amber-300 mb-1">Belum Ada Penugasan Mapel</p>
                        <p>
                          Mata pelajaran akan muncul otomatis setelah Admin menetapkan penugasan mengajar untuk akun Anda.
                        </p>
                      </div>
                    ) : (
                      teacherSubjectGroups.map((group) => {
                        const isExpanded = !!openSubjects[group.subjectId];
                        const primaryAsg = group.assignments[0];
                        const classLabel = group.assignments
                          .map((a) => a.class?.name?.replace(/^Kelas\s+/i, 'Kls ') || `Kls ${a.class?.level || ''}`)
                          .join(', ');
                        const scopeConfigs = curriculumWorkspaceService.getLingkupMateriList(
                          group.subjectId,
                          primaryAsg.class?.level || 4
                        );
                        const isCurrentSubjectSelected = selectedSubjectId === group.subjectId;

                        return (
                          <div key={group.subjectId} className="rounded-xl bg-emerald-900/50 border border-emerald-800/80 p-2">
                            <button
                              onClick={() => toggleSubject(group.subjectId)}
                              className={`flex items-center justify-between w-full px-2 py-1.5 text-xs font-bold transition-colors text-left rounded-md ${
                                isCurrentSubjectSelected || isExpanded
                                  ? 'text-amber-300 hover:text-amber-200'
                                  : 'text-emerald-100 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Folder className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                <span className="truncate">
                                  {group.subjectName} ({classLabel})
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="pl-3 mt-1.5 space-y-1 border-l-2 border-amber-400/50 ml-2">
                                {group.assignments.length > 1 && (
                                  <div className="flex flex-wrap gap-1 px-2 pb-1">
                                    {group.assignments.map((asg) => (
                                      <button
                                        key={asg.id}
                                        onClick={() => handleSubjectModuleClick('cp', asg)}
                                        className="px-1.5 py-0.5 rounded bg-emerald-800 hover:bg-amber-400 hover:text-emerald-950 text-[10px] font-semibold text-amber-200 transition-colors"
                                        title={`Buka perangkat untuk ${asg.class?.name}`}
                                      >
                                        {asg.class?.name}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Perangkat Pembelajaran (Ringkas — Tab Menu Lengkap di Halaman) */}
                                <div className="pt-1">
                                  {(() => {
                                    const isPerangkatActive =
                                      isCurrentSubjectSelected &&
                                      ['perangkat-pembelajaran', 'cp', 'tp', 'atp', 'prota', 'promes', 'modul-ajar', 'lkpd'].includes(
                                        activeView
                                      );
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleSubjectModuleClick('perangkat-pembelajaran', primaryAsg)}
                                        className={`flex items-center w-full px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors text-left ${
                                          isPerangkatActive
                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 shadow-xs'
                                            : 'text-amber-300 hover:bg-emerald-800/80 hover:text-amber-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <FolderSync
                                            className={`w-3.5 h-3.5 shrink-0 ${
                                              isPerangkatActive ? 'text-emerald-950' : 'text-amber-400'
                                            }`}
                                          />
                                          <span className="truncate">Perangkat Pembelajaran</span>
                                        </div>
                                      </button>
                                    );
                                  })()}
                                </div>

                                {/* Perangkat Evaluasi per Lingkup Materi */}
                                <div className="pt-2">
                                  <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold text-emerald-100">
                                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Perangkat Evaluasi</span>
                                  </div>
                                  <div className="pl-4 space-y-0.5 text-[11px]">
                                    {scopeConfigs.length === 0 ? (
                                      <button
                                        onClick={() => handleSubjectModuleClick('kisi-kisi', primaryAsg)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-amber-300 hover:bg-emerald-800 hover:text-white transition-colors"
                                      >
                                        <span className="text-emerald-400 font-bold font-mono">├─</span>
                                        <span className="truncate font-semibold">+ Tambah Lingkup Materi</span>
                                      </button>
                                    ) : (
                                      scopeConfigs.map((sc, sIdx) => {
                                        const viewMap: Record<string, string> = {
                                          LM1: 'eval-lm1',
                                          LM2: 'eval-lm2',
                                          STS: 'eval-sts',
                                          LM3: 'eval-lm3',
                                          LM4: 'eval-lm4',
                                          SAS: 'eval-sas',
                                        };
                                        const targetView = viewMap[sc.scope_key] || `eval-scope:${sc.scope_key}`;
                                        const isSubActive = activeView === targetView && isCurrentSubjectSelected;
                                        const isLast = sIdx === scopeConfigs.length - 1;

                                        return (
                                          <button
                                            key={sc.id}
                                            onClick={() => handleSubjectModuleClick(targetView, primaryAsg)}
                                            className={`flex items-center w-full px-2 py-1 rounded transition-colors text-left ${
                                              isSubActive
                                                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                                                : 'text-emerald-100/85 hover:bg-emerald-800/80 hover:text-amber-200'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 truncate">
                                              <span className={`font-bold font-mono ${isSubActive ? 'text-emerald-900' : 'text-emerald-500'}`}>
                                                {isLast ? '└─' : '├─'}
                                              </span>
                                              <span className="truncate">
                                                {sc.is_special_summative ? `${sc.code}` : `${sc.code}: ${sc.title}`}
                                              </span>
                                            </div>
                                          </button>
                                        );
                                      })
                                    )}

                                    <button
                                      onClick={() => handleSubjectModuleClick('asesmen-nilai', primaryAsg)}
                                      className={`flex items-center w-full px-2 py-1 rounded transition-colors text-left mt-1 border-t border-emerald-800/80 pt-1.5 ${
                                        activeView === 'asesmen-nilai' && isCurrentSubjectSelected
                                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                                          : 'text-amber-200 hover:bg-emerald-800 hover:text-white'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span className={`font-bold font-mono ${activeView === 'asesmen-nilai' && isCurrentSubjectSelected ? 'text-emerald-900' : 'text-amber-400'}`}>├─</span>
                                        <span className="font-bold truncate">Daftar Nilai Siswa</span>
                                      </div>
                                    </button>

                                    <button
                                      onClick={() => handleSubjectModuleClick('leger-nilai', primaryAsg)}
                                      className={`flex items-center w-full px-2 py-1 rounded transition-colors text-left ${
                                        activeView === 'leger-nilai' && isCurrentSubjectSelected
                                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                                          : 'text-amber-300 hover:bg-emerald-800 hover:text-white'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span className={`font-bold font-mono ${activeView === 'leger-nilai' && isCurrentSubjectSelected ? 'text-emerald-900' : 'text-amber-400'}`}>└─</span>
                                        <span className="font-bold truncate">Leger Nilai & Rapor</span>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2B. Menu Khusus Ko Kurikuler */}
                <div>
                  <p className="px-3 text-[10px] font-semibold text-emerald-300/70 uppercase tracking-wider">
                    KO KURIKULER
                  </p>
                  <div className="mt-1.5 rounded-xl bg-emerald-900/50 border border-emerald-800/80 p-2">
                    <button
                      type="button"
                      onClick={() => setOpenKoKurikuler((prev) => !prev)}
                      className={`flex items-center justify-between w-full px-2 py-1.5 text-xs font-bold transition-colors text-left rounded-md ${
                        activeView.startsWith('kokurikuler') || openKoKurikuler
                          ? 'text-amber-300 hover:text-amber-200'
                          : 'text-emerald-100 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Compass className="w-4 h-4 shrink-0 text-amber-400" />
                        <span className="truncate">Menu Ko Kurikuler</span>
                      </div>
                      {openKoKurikuler ? (
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      )}
                    </button>

                    {openKoKurikuler && (
                      <div className="pl-3 mt-1.5 space-y-1 border-l-2 border-amber-400/50 ml-2">
                        {KOKURIKULER_SUBMENUS.map((sub, idx) => {
                          const subIcons: Record<KoKurikulerSubMenu, React.ComponentType<{ className?: string }>> = {
                            perencanaan: Compass,
                            'bahan-ajar': BookOpen,
                            asesmen: ClipboardCheck,
                            administrasi: FileArchive,
                          };
                          const SubIcon = subIcons[sub.key];
                          const isSubActive =
                            activeView === sub.viewId ||
                            (activeView === 'kokurikuler' && sub.key === 'perencanaan');
                          const isLast = idx === KOKURIKULER_SUBMENUS.length - 1;

                          return (
                            <button
                              key={sub.key}
                              type="button"
                              onClick={() => handleItemClick(sub.viewId)}
                              className={`flex items-center w-full px-2 py-1.5 rounded-lg text-[11px] transition-colors text-left ${
                                isSubActive
                                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                                  : 'text-emerald-100/85 hover:bg-emerald-800/80 hover:text-amber-200 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className={`font-bold font-mono text-[10px] ${isSubActive ? 'text-emerald-900' : 'text-emerald-500'}`}>
                                  {isLast ? '└─' : '├─'}
                                </span>
                                <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-emerald-950' : 'text-amber-400'}`} />
                                <span className="truncate">{sub.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Jurnal, Supervisi, & Ekspor Data */}
                <div>
                  <p className="px-3 text-[10px] font-semibold text-emerald-300/70 uppercase tracking-wider">
                    JURNAL & SUPERVISI
                  </p>
                  <div className="mt-1 space-y-1">
                    <button
                      onClick={() => handleItemClick('jurnal-mengajar')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'jurnal-mengajar'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <ClipboardList className={`w-4 h-4 shrink-0 ${activeView === 'jurnal-mengajar' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span className="truncate">Jurnal Mengajar</span>
                    </button>

                    <button
                      onClick={() => handleItemClick('supervisi-guru')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'supervisi-guru' || activeView === 'supervisi-kbm'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <Award className={`w-4 h-4 shrink-0 ${activeView === 'supervisi-guru' || activeView === 'supervisi-kbm' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span className="truncate">Riwayat Supervisi</span>
                    </button>
                  </div>
                </div>

                {/* 4. Layanan Pendukung Guru */}
                <div>
                  <p className="px-3 text-[10px] font-semibold text-emerald-300/70 uppercase tracking-wider">
                    PENDUKUNG GURU
                  </p>
                  <div className="mt-1 space-y-1">
                    <button
                      onClick={() => handleItemClick('penyimpanan-drive')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'penyimpanan-drive'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <HardDrive className={`w-4 h-4 shrink-0 ${activeView === 'penyimpanan-drive' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span className="truncate">Penyimpanan Google Drive</span>
                    </button>

                    <button
                      onClick={() => handleItemClick('arsip-drive')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'arsip-drive'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <FolderSync className={`w-4 h-4 shrink-0 ${activeView === 'arsip-drive' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span className="truncate">Arsip &amp; Kirim Dokumen (Drive)</span>
                    </button>

                    <button
                      onClick={() => handleItemClick('bimbingan-siswa')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'bimbingan-siswa'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <HeartHandshake className={`w-4 h-4 shrink-0 ${activeView === 'bimbingan-siswa' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span>Bimbingan Siswa (BK)</span>
                    </button>

                    <button
                      onClick={() => handleItemClick('asisten-ai')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'asisten-ai'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <Sparkles className={`w-4 h-4 shrink-0 ${activeView === 'asisten-ai' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span>Asisten AI Gemini</span>
                    </button>

                    <button
                      onClick={() => handleItemClick('lapor-kendala')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'lapor-kendala'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <LifeBuoy className={`w-4 h-4 shrink-0 ${activeView === 'lapor-kendala' ? 'text-emerald-950' : 'text-emerald-300'}`} />
                      <span>Lapor Kendala Teknis</span>
                    </button>

                    <button
                      onClick={() => handleItemClick('pusat-bantuan')}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        activeView === 'pusat-bantuan'
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                          : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                      }`}
                    >
                      <BookOpen className={`w-4 h-4 shrink-0 ${activeView === 'pusat-bantuan' ? 'text-emerald-950' : 'text-amber-400'}`} />
                      <span>Pusat Bantuan SIMPEL</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Navigasi Standard Peran Lain (Admin, Kepala Madrasah, Wali Kelas) */
            navSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                {collapsed ? (
                  idx > 0 && <div className="mx-auto w-8 border-t border-emerald-800/80 my-2" />
                ) : (
                  <p className="px-3 text-[10px] font-semibold text-emerald-300/70 uppercase tracking-wider">
                    {sec.section}
                  </p>
                )}
                <div className={`space-y-0.5 mt-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      activeView === item.id ||
                      (item.id === 'penugasan-guru' && activeView.startsWith('penugasan-')) ||
                      (item.id === 'kokurikuler-perencanaan' && activeView.startsWith('kokurikuler'));

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        title={collapsed ? item.label : undefined}
                        aria-label={item.label}
                        className={`flex items-center rounded-lg transition-colors ${
                          collapsed
                            ? 'justify-center w-11 h-10'
                            : 'gap-2.5 w-full px-3 py-2 text-xs font-medium text-left'
                        } ${
                          isActive
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-xs'
                            : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-amber-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-950' : 'text-amber-400'}`} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Bottom Info, Collapse Toggle & Logout */}
        <div className="p-3 bg-emerald-950/90 border-t border-emerald-900 shrink-0 space-y-1">
          <button
            type="button"
            onClick={toggleCollapse}
            title={collapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
            aria-label={collapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
            className={`hidden md:flex items-center rounded-lg text-xs font-medium text-emerald-200/80 hover:bg-emerald-900 hover:text-amber-300 transition-colors cursor-pointer ${
              collapsed ? 'justify-center w-11 h-9 mx-auto' : 'gap-2 w-full px-3 py-2'
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Ciutkan Sidebar</span>
              </>
            )}
          </button>
          <button
            onClick={logout}
            title={collapsed ? 'Keluar Aplikasi' : undefined}
            aria-label="Keluar Aplikasi"
            className={`flex items-center text-xs font-medium text-emerald-200/80 rounded-lg hover:bg-rose-950/40 hover:text-rose-300 transition-colors ${
              collapsed ? 'justify-center w-11 h-9 mx-auto' : 'gap-2 w-full px-3 py-2'
            }`}
          >
            <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
            {!collapsed && <span>Keluar Aplikasi</span>}
          </button>
        </div>
      </aside>
    </>
  );
});
