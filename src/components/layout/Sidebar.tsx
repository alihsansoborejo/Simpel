import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { academicService } from '../../services/academicService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { TeachingAssignment } from '../../types/database.types';
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
  ChevronRight,
  Folder,
  LifeBuoy,
  HardDrive,
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

interface SidebarSubjectGroup {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  assignments: TeachingAssignment[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user, activeRole, logout } = useAuth();
  const { logoUrl, settings } = useAppSettings();
  const { selectedSubjectId, setWorkspaceSelection } = useWorkspace();
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [teacherSubjectGroups, setTeacherSubjectGroups] = useState<SidebarSubjectGroup[]>([]);
  const [isLoadingTeacherMenu, setIsLoadingTeacherMenu] = useState<boolean>(false);
  const [isPenugasanExpanded, setIsPenugasanExpanded] = useState<boolean>(true);

  const loadTeacherSubjects = async () => {
    if (activeRole !== 'guru' || !user) {
      setTeacherSubjectGroups([]);
      return;
    }
    setIsLoadingTeacherMenu(true);
    try {
      const [teacher, assignments] = await Promise.all([
        academicService.resolveTeacherForUser(user),
        academicService.getTeachingAssignments(),
      ]);

      const teacherId = teacher?.id || user.teacherId;
      const mine = teacherId ? assignments.filter((a) => a.teacher_id === teacherId) : [];

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
            assignments: [asg],
          });
        }
      }

      const groups = Array.from(groupMap.values()).map((g) => ({
        ...g,
        assignments: g.assignments.sort((a, b) => (a.class?.level || 0) - (b.class?.level || 0)),
      }));

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
  };

  useEffect(() => {
    void loadTeacherSubjects();
  }, [user?.id, user?.teacherId, activeRole]);

  useRealtimeSync(
    ['simpel_assignments', 'simpel_teachers', 'simpel_classes', 'simpel_subjects', 'simpel_users_cache_v2'],
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
              { id: 'penyimpanan-drive', label: 'Penyimpanan Google Drive', icon: HardDrive, badge: 'Cloud' },
              { id: 'migrasi-data', label: 'Pusat Migrasi Data', icon: FileSpreadsheet, badge: 'Impor' },
              { id: 'pengaturan-identitas', label: 'Identitas & Logo', icon: School, badge: 'Tahap 8' },
              { id: 'pengaturan-akademik', label: 'Tahun Ajaran & KKTP', icon: Database },
            ],
          },
          {
            section: 'AUDIT & OPERASIONAL',
            items: [
              { id: 'lapor-kendala', label: 'Evaluasi & Lapor Kendala', icon: LifeBuoy, badge: 'Tahap 8' },
              { id: 'pusat-bantuan', label: 'Pusat Bantuan & Panduan', icon: BookOpen },
              { id: 'log-aktivitas', label: 'Log Aktivitas Sistem', icon: ClipboardList },
              { id: 'asisten-ai', label: 'Asisten AI Gemini', icon: Sparkles, badge: 'Tahap 6' },
            ],
          },
        ];

      case 'kepala_madrasah':
        return [
          {
            section: 'MANAJERIAL',
            items: [
              { id: 'dashboard', label: 'Dashboard Eksekutif', icon: LayoutDashboard },
              { id: 'supervisi-kbm', label: 'Supervisi Akademik & KBM', icon: Award, badge: 'Tabel/Ekspor' },
              { id: 'arsip-drive', label: 'Telaah Dokumen Kurikulum', icon: FolderSync },
              { id: 'penyimpanan-drive', label: 'Penyimpanan Google Drive', icon: HardDrive, badge: 'Cloud' },
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
              { id: 'lapor-kendala', label: 'Evaluasi & Lapor Kendala', icon: LifeBuoy },
              { id: 'pusat-bantuan', label: 'Pusat Bantuan SIMPEL', icon: BookOpen },
            ],
          },
          {
            section: 'KECERDASAN BUATAN',
            items: [
              { id: 'asisten-ai-kamad', label: 'AI Asisten Kepala Madrasah', icon: Sparkles, badge: 'Eksekutif' },
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
              { id: 'presensi', label: 'Presensi Harian Rombel', icon: CalendarCheck, badge: 'Harian' },
              { id: 'siswa-kelas', label: 'Daftar Siswa Kelas', icon: Users },
              { id: 'penyimpanan-drive', label: 'Penyimpanan Google Drive', icon: HardDrive, badge: 'Cloud' },
              { id: 'monitoring-nilai-mapel', label: 'Monitoring Nilai Mapel', icon: Award },
              { id: 'rekap-presensi-kelas', label: 'Rekap Presensi Rombel', icon: CalendarCheck },
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
              { id: 'asisten-ai-analisis', label: 'AI Analisis & Narasi Rapor', icon: Sparkles, badge: 'Cerdas' },
              { id: 'asisten-ai', label: 'Asisten AI Gemini', icon: Sparkles },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const navSections = getNavItems();

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
        className={`fixed md:sticky top-0 left-0 z-50 flex flex-col w-68 h-screen bg-slate-900 text-slate-200 border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="flex items-center justify-between h-16 px-5 bg-emerald-900/80 border-b border-emerald-800/80 shrink-0">
          <div className="flex items-center gap-3 truncate">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo Madrasah"
                className="w-10 h-10 object-contain rounded-lg shrink-0 p-0.5 bg-emerald-950/50 border border-emerald-700/60 shadow-xs"
              />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-700 text-amber-300 font-extrabold text-lg shadow-inner shrink-0">
                IH
              </div>
            )}
            <div className="truncate">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight truncate">
                SIMPEL MI AL IHSAN
              </h1>
              <p className="text-[10px] text-emerald-200 font-medium truncate">
                {settings?.school_name || 'MI Ma’arif Al Ihsan Soborejo'}
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {activeRole === 'guru' ? (
            /* =========================================================================
               STRUKTUR KHUSUS DASHBOR GURU SESUAI SPESIFIKASI USER:
               DASHBOR GURU
               ---- Presensi Siswa Harian
               ---- Mata Pelajaran
                     |---- BAHASA INDONESIA
                             ---- Perangkat Pembelajaran (CP, TP, ATP, dll)
                             ---- Perangkat Evaluasi (Kisi-kisi, Soal, Daftar nilai, dll)
                     |---- IPAS
               ---- Jurnal Mengajar (Tabel & Ekspor)
               ---- Riwayat Supervisi (Tabel & Ekspor)
               ========================================================================= */
            <div className="space-y-4">
              {/* Grup Utama: DASHBOR GURU */}
              <div>
                <p className="px-3 text-[10px] font-bold text-amber-400 tracking-wider">
                  DASHBOR GURU
                </p>
                <div className="mt-1 space-y-1">
                  {/* Dashboard Overview */}
                  <button
                    onClick={() => handleItemClick('dashboard')}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${
                      activeView === 'dashboard'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                      <span>Beranda Guru</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Hierarki Mata Pelajaran Diampu */}
              <div>
                <div className="flex items-center justify-between px-3 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mata Pelajaran Diampu</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {isLoadingTeacherMenu ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                      Memuat mata pelajaran diampu...
                    </div>
                  ) : teacherSubjectGroups.length === 0 ? (
                    <div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-3 text-[11px] text-slate-400 leading-relaxed">
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
                        <div key={group.subjectId} className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-2">
                          <button
                            onClick={() => toggleSubject(group.subjectId)}
                            className={`flex items-center justify-between w-full px-2 py-1.5 text-xs font-bold transition-colors text-left rounded-md ${
                              isCurrentSubjectSelected || isExpanded
                                ? 'text-emerald-300 hover:text-emerald-200'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Folder className={`w-3.5 h-3.5 shrink-0 ${isExpanded ? 'text-amber-400' : 'text-emerald-400'}`} />
                              <span className="truncate">
                                {group.subjectName} ({classLabel})
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="pl-3 mt-1.5 space-y-1 border-l-2 border-emerald-800/60 ml-2">
                              {group.assignments.length > 1 && (
                                <div className="flex flex-wrap gap-1 px-2 pb-1">
                                  {group.assignments.map((asg) => (
                                    <button
                                      key={asg.id}
                                      onClick={() => handleSubjectModuleClick('cp', asg)}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-800 text-[10px] font-semibold text-emerald-200 transition-colors"
                                      title={`Buka perangkat untuk ${asg.class?.name}`}
                                    >
                                      {asg.class?.name}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Perangkat Pembelajaran */}
                              <div className="pt-1">
                                <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold text-emerald-300">
                                  <FolderSync className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Perangkat Pembelajaran</span>
                                </div>
                                <div className="pl-4 space-y-0.5 text-[11px]">
                                  {[
                                    { view: 'cp', prefix: '├─', label: 'CP (Capaian)' },
                                    { view: 'tp', prefix: '├─', label: 'TP (Tujuan)' },
                                    { view: 'atp', prefix: '├─', label: 'ATP (Alur TP)' },
                                    { view: 'modul-ajar', prefix: '├─', label: 'Modul Ajar' },
                                    { view: 'lkpd', prefix: '└─', label: 'LKPD (Lembar Kerja)' },
                                  ].map((navItem) => {
                                    const isSubActive = activeView === navItem.view && isCurrentSubjectSelected;
                                    return (
                                      <button
                                        key={navItem.view}
                                        onClick={() => handleSubjectModuleClick(navItem.view, primaryAsg)}
                                        className={`flex items-center gap-2 w-full px-2 py-1 rounded transition-colors text-left ${
                                          isSubActive
                                            ? 'bg-emerald-600 text-white font-bold'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                      >
                                        <span className="text-emerald-400 font-bold font-mono">{navItem.prefix}</span>
                                        <span className="truncate">{navItem.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Perangkat Evaluasi per Lingkup Materi */}
                              <div className="pt-2">
                                <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold text-amber-300">
                                  <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Perangkat Evaluasi</span>
                                </div>
                                <div className="pl-4 space-y-0.5 text-[11px]">
                                  {scopeConfigs.map((sc, sIdx) => {
                                    const viewMap: Record<string, string> = {
                                      LM1: 'eval-lm1',
                                      LM2: 'eval-lm2',
                                      STS: 'eval-sts',
                                      LM3: 'eval-lm3',
                                      LM4: 'eval-lm4',
                                      SAS: 'eval-sas',
                                    };
                                    const targetView = viewMap[sc.scope_key] || 'kisi-kisi';
                                    const isSubActive = activeView === targetView && isCurrentSubjectSelected;
                                    const isLast = sIdx === scopeConfigs.length - 1;

                                    return (
                                      <button
                                        key={sc.id}
                                        onClick={() => handleSubjectModuleClick(targetView, primaryAsg)}
                                        className={`flex items-center justify-between w-full px-2 py-1 rounded transition-colors text-left ${
                                          isSubActive
                                            ? 'bg-amber-500 text-slate-900 font-bold'
                                            : sc.is_special_summative
                                            ? 'text-amber-300 hover:bg-amber-950/40 hover:text-amber-200'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span className="text-amber-400 font-bold font-mono">
                                            {isLast ? '└─' : '├─'}
                                          </span>
                                          <span className="truncate">
                                            {sc.is_special_summative ? `${sc.code}` : `${sc.code}: ${sc.title}`}
                                          </span>
                                        </div>
                                        {sc.is_special_summative && (
                                          <span className="px-1 text-[9px] font-extrabold rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                                            {sc.code}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}

                                  <button
                                    onClick={() => handleSubjectModuleClick('leger-nilai', primaryAsg)}
                                    className={`flex items-center justify-between w-full px-2 py-1 rounded transition-colors text-left mt-1 border-t border-slate-800/60 pt-1.5 ${
                                      activeView === 'leger-nilai' && isCurrentSubjectSelected
                                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                        : 'text-emerald-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="text-emerald-400 font-bold font-mono">└─</span>
                                      <span className="font-bold truncate">Leger Nilai & Rapor</span>
                                    </div>
                                    <span className="px-1 text-[9px] font-bold rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 shrink-0">
                                      Leger
                                    </span>
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

              {/* 3. Jurnal, Supervisi, & Ekspor Data */}
              <div>
                <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  JURNAL & SUPERVISI
                </p>
                <div className="mt-1 space-y-1">
                  <button
                    onClick={() => handleItemClick('jurnal-mengajar')}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'jurnal-mengajar'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <ClipboardList className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">Jurnal Mengajar</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-emerald-800 text-emerald-200">
                      Tabel/Ekspor
                    </span>
                  </button>

                  <button
                    onClick={() => handleItemClick('supervisi-guru')}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'supervisi-guru' || activeView === 'supervisi-kbm'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Award className="w-4 h-4 text-amber-300 shrink-0" />
                      <span className="truncate">Riwayat Supervisi</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-400 text-slate-900">
                      Tabel/Ekspor
                    </span>
                  </button>
                </div>
              </div>

              {/* 4. Layanan Pendukung Guru */}
              <div>
                <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  PENDUKUNG GURU
                </p>
                <div className="mt-1 space-y-1">
                  <button
                    onClick={() => handleItemClick('penyimpanan-drive')}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'penyimpanan-drive'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Penyimpanan Google Drive</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500 text-white">
                      Cloud
                    </span>
                  </button>

                  <button
                    onClick={() => handleItemClick('bimbingan-siswa')}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'bimbingan-siswa'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <HeartHandshake className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Bimbingan Siswa (BK)</span>
                  </button>

                  <button
                    onClick={() => handleItemClick('asisten-ai')}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'asisten-ai'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>Asisten AI Gemini</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-400 text-slate-900">
                      Cerdas
                    </span>
                  </button>

                  <button
                    onClick={() => handleItemClick('lapor-kendala')}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'lapor-kendala'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <LifeBuoy className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Lapor Kendala Teknis</span>
                  </button>

                  <button
                    onClick={() => handleItemClick('pusat-bantuan')}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                      activeView === 'pusat-bantuan'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pusat Bantuan SIMPEL</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Navigasi Standard Peran Lain (Admin, Kepala Madrasah, Wali Kelas) */
            navSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {sec.section}
                </p>
                <div className="space-y-0.5 mt-1">
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    // Sub-menu Rombel khusus Penugasan Mengajar untuk Admin
                    if (item.id === 'penugasan-guru' && activeRole === 'admin') {
                      const isPenugasanActive = activeView.startsWith('penugasan-');
                      return (
                        <div key={item.id} className="space-y-1">
                          <button
                            onClick={() => {
                              setIsPenugasanExpanded(!isPenugasanExpanded);
                              handleItemClick('penugasan-guru');
                            }}
                            className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${
                              isPenugasanActive
                                ? 'bg-emerald-900/90 text-white border border-emerald-700/60 shadow-xs'
                                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <ClipboardList className={`w-4 h-4 shrink-0 ${isPenugasanActive ? 'text-amber-400' : 'text-slate-400'}`} />
                              <span className="truncate">Penugasan Mengajar (SK)</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-400 text-slate-950">
                                Rombel
                              </span>
                              {isPenugasanExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* Sub-menu Rombel (Kelas) */}
                          {isPenugasanExpanded && (
                            <div className="pl-3 ml-3 border-l-2 border-emerald-800/60 space-y-0.5 my-1">
                              {[
                                { id: 'penugasan-cls-1', label: 'Rombel Kelas 1', phase: 'A' },
                                { id: 'penugasan-cls-2', label: 'Rombel Kelas 2', phase: 'A' },
                                { id: 'penugasan-cls-3', label: 'Rombel Kelas 3', phase: 'B' },
                                { id: 'penugasan-cls-4', label: 'Rombel Kelas 4', phase: 'B' },
                                { id: 'penugasan-cls-5', label: 'Rombel Kelas 5', phase: 'C' },
                                { id: 'penugasan-cls-6', label: 'Rombel Kelas 6', phase: 'C' },
                                { id: 'penugasan-rekap', label: '📊 Matriks Seluruh Rombel' },
                              ].map((sub) => {
                                const isSubActive = activeView === sub.id;
                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => handleItemClick(sub.id)}
                                    className={`flex items-center justify-between w-full px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors text-left ${
                                      isSubActive
                                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSubActive ? 'bg-amber-300' : 'bg-slate-500'}`} />
                                      <span className="truncate">{sub.label}</span>
                                    </div>
                                    {sub.phase && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                        Fase {sub.phase}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

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
            ))
          )}
        </nav>

        {/* Bottom Info & Logout */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 shrink-0">
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
