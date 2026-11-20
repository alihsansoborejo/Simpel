import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import {
  fetchTeacherDashboardData,
  TeacherDashboardData,
} from '../../services/dashboardService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import { academicService } from '../../services/academicService';
import { kokurikulerService } from '../../services/kokurikulerService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { KOKURIKULER_SUBMENUS, KoKurikulerSubMenu } from '../../types/kokurikuler.types';
import {
  ClipboardList,
  Sparkles,
  Award,
  FolderSync,
  ArrowRight,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  Compass,
  ClipboardCheck,
  FileArchive,
} from 'lucide-react';

interface TeacherDashboardProps {
  onNavigate: (view: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const {
    selectedSubjectId,
    selectedAssignmentId,
    setWorkspaceSelection,
  } = useWorkspace();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>('');
  const [scopeVersion, setScopeVersion] = useState<number>(0);
  const [koKurikulerCounts, setKoKurikulerCounts] = useState<Record<KoKurikulerSubMenu, number>>({
    perencanaan: 0,
    'bahan-ajar': 0,
    asesmen: 0,
    administrasi: 0,
  });

  const loadData = async () => {
    try {
      const [res, teacher, teachersPool, allKoItems] = await Promise.all([
        fetchTeacherDashboardData(user?.teacherId, user),
        user ? academicService.resolveTeacherForUser(user) : Promise.resolve(null),
        academicService.getTeachers(),
        kokurikulerService.fetchAll(),
      ]);
      setData(res);

      const { candidateTeacherIds, candidateUserIds } = user
        ? academicService.getMatchingTeacherIdsForUser(user, teacher, teachersPool)
        : { candidateTeacherIds: new Set<string>(), candidateUserIds: new Set<string>() };
      setKoKurikulerCounts(
        kokurikulerService.getCountsBySubMenu(
          undefined,
          {
            teacherIds: Array.from(candidateTeacherIds),
            userIds: Array.from(candidateUserIds),
            email: user?.email,
            fullName: user?.profile?.full_name,
          },
          allKoItems
        )
      );

      if (res.subjectsSummary.length > 0) {
        const preferredSubject =
          res.subjectsSummary.find((s) => s.subjectId === selectedSubjectId) ||
          res.subjectsSummary.find((s) => s.subjectId === activeSubjectId) ||
          res.subjectsSummary[0];

        setActiveSubjectId(preferredSubject.subjectId);

        const preferredSlot =
          preferredSubject.classes.find((c) => c.assignmentId === selectedAssignmentId) ||
          preferredSubject.classes.find((c) => c.assignmentId === activeAssignmentId) ||
          preferredSubject.classes[0];

        if (preferredSlot) {
          setActiveAssignmentId(preferredSlot.assignmentId);
        }
      } else {
        setActiveSubjectId('');
        setActiveAssignmentId('');
      }
    } catch (err) {
      console.error('Error loading teacher dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, user?.email, user?.teacherId, user?.profile?.full_name]);

  useRealtimeSync(
    [
      'simpel_assignments',
      'simpel_teachers',
      'simpel_classes',
      'simpel_subjects',
      'simpel_homeroom_assignments',
      'simpel_academic_years',
      'simpel_semesters',
      'simpel_teaching_journals',
      'simpel_supervision_records',
      'simpel_curriculum_documents',
      'simpel_settings',
      'simpel_users_cache_v2',
      'simpel_mi_lingkup_materi_custom_v1',
      'simpel_mi_lingkup_materi_hidden_v1',
      'simpel_mi_kisi_items_v1',
      'simpel_mi_soal_items_v1',
      'simpel_mi_kokurikuler_items_v1',
    ],
    () => {
      setScopeVersion((v) => v + 1);
      void loadData();
    }
  );

  const selectedSubjectGroup = useMemo(() => {
    if (!data || data.subjectsSummary.length === 0) return null;
    return (
      data.subjectsSummary.find((s) => s.subjectId === activeSubjectId) ||
      data.subjectsSummary[0]
    );
  }, [data, activeSubjectId]);

  const selectedSlot = useMemo(() => {
    if (!selectedSubjectGroup || selectedSubjectGroup.classes.length === 0) return null;
    return (
      selectedSubjectGroup.classes.find((c) => c.assignmentId === activeAssignmentId) ||
      selectedSubjectGroup.classes[0]
    );
  }, [selectedSubjectGroup, activeAssignmentId]);

  const scopeConfigs = useMemo(() => {
    if (!selectedSlot) return [];
    const semesterArg = data?.semesterName === 'Genap' ? 'Genap' : 'Ganjil';
    return curriculumWorkspaceService.getLingkupMateriList(
      selectedSlot.subjectId,
      selectedSlot.classLevel,
      semesterArg
    );
  }, [selectedSlot, data?.semesterName, scopeVersion]);

  const navigateWithWorkspace = (view: string) => {
    if (selectedSlot) {
      setWorkspaceSelection({
        subjectId: selectedSlot.subjectId,
        classId: selectedSlot.classId,
        classLevel: selectedSlot.classLevel,
        assignmentId: selectedSlot.assignmentId,
      });
    }
    onNavigate(view);
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Utama */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm border border-amber-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-emerald-950">
              DASHBOR GURU
            </span>
            <span className="text-xs text-emerald-100 font-medium">
              {settings?.school_name || 'MI Ma’arif Al Ihsan Soborejo'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold mt-2 tracking-tight text-amber-50">
            Selamat Bertugas, {data.teacherName}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            NIP: {data.nip} · Bidang: {data.specialization} · TP {data.academicYearName} Semester {data.semesterName}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => navigateWithWorkspace('jurnal-mengajar')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-100 bg-emerald-900/70 hover:bg-emerald-800 transition-colors border border-amber-400/40"
          >
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <span>Jurnal Mengajar Hari Ini</span>
          </button>
          <button
            onClick={() => navigateWithWorkspace('asisten-ai')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-300 to-yellow-400 hover:from-amber-400 hover:to-yellow-500 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-950" />
            <span>Asisten Gemini</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Cepat Operasional */}
      <div className="p-4 rounded-xl bg-white border border-emerald-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-amber-300/70 text-emerald-700 shrink-0 mt-0.5">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-slate-900">
                  Jurnal Mengajar &amp; Pelaksanaan KBM
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                  {data.totalSubjectsTaught} Mapel · {data.assignedClassesCount} Rombel Diampu
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Catat keterlaksanaan modul ajar, aktivitas pembelajaran mendalam, dan dokumentasi jam tatap muka.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => navigateWithWorkspace('jurnal-mengajar')}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold text-xs hover:from-amber-500 hover:to-yellow-500 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Buka Jurnal Mengajar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mata Pelajaran yang Diampu (Dinamis dari Penugasan Mengajar Admin) */}
      <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700" />
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                Mata Pelajaran yang Diampu
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Terhubung langsung dengan SK Penugasan Mengajar yang ditetapkan Administrator Madrasah
            </p>
          </div>

          {/* Tab Pemilih Mapel Dinamis */}
          {data.subjectsSummary.length > 0 && (
            <div className="flex items-center gap-1 bg-emerald-50/70 border border-emerald-200/80 p-1 rounded-xl flex-wrap">
              {data.subjectsSummary.map((sbj) => {
                const isSelected = selectedSubjectGroup?.subjectId === sbj.subjectId;
                return (
                  <button
                    key={sbj.subjectId}
                    onClick={() => {
                      setActiveSubjectId(sbj.subjectId);
                      const firstSlot = sbj.classes[0];
                      if (firstSlot) {
                        setActiveAssignmentId(firstSlot.assignmentId);
                        setWorkspaceSelection({
                          subjectId: firstSlot.subjectId,
                          classId: firstSlot.classId,
                          classLevel: firstSlot.classLevel,
                          assignmentId: firstSlot.assignmentId,
                        });
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 shadow-xs'
                        : 'text-emerald-900/75 hover:text-emerald-950 hover:bg-emerald-100/70'
                    }`}
                  >
                    {sbj.subjectName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspace Mapel Terpilih atau Empty State */}
        {data.subjectsSummary.length === 0 || !selectedSubjectGroup || !selectedSlot ? (
          <div className="p-6 rounded-xl border border-amber-200 bg-amber-50/70 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-amber-950 text-sm">
                Belum Ada Penugasan Mata Pelajaran untuk Akun Anda
              </h4>
              <p className="text-amber-900 leading-relaxed">
                Administrator madrasah belum memetakan mata pelajaran dan rombel kelas untuk{' '}
                <strong>{data.teacherName}</strong> di menu <strong>Penugasan Mengajar (SK)</strong>.
                Setelah Admin menyimpan penugasan, daftar mata pelajaran, perangkat pembelajaran, evaluasi, jurnal, dan leger akan langsung aktif di sini.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Mapel + Pemilih Rombel Jika Mengampu > 1 Kelas */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-amber-300">
                    {selectedSubjectGroup.subjectCategory} · {selectedSlot.className}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-emerald-950 border border-amber-300">
                    Fase {selectedSlot.phase}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-emerald-950 mt-1.5">
                  {selectedSubjectGroup.subjectName} ({selectedSubjectGroup.subjectCode})
                </h4>
                <p className="text-xs text-slate-600">
                  Guru Pengampu: {data.teacherName} · Rombel Aktif: {selectedSlot.className}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedSubjectGroup.classes.length > 1 && (
                  <select
                    value={selectedSlot.assignmentId}
                    onChange={(e) => {
                      const next = selectedSubjectGroup.classes.find(
                        (c) => c.assignmentId === e.target.value
                      );
                      if (next) {
                        setActiveAssignmentId(next.assignmentId);
                        setWorkspaceSelection({
                          subjectId: next.subjectId,
                          classId: next.classId,
                          classLevel: next.classLevel,
                          assignmentId: next.assignmentId,
                        });
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-950 font-bold text-xs"
                  >
                    {selectedSubjectGroup.classes.map((clsSlot) => (
                      <option key={clsSlot.assignmentId} value={clsSlot.assignmentId}>
                        {clsSlot.className} (Fase {clsSlot.phase})
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => navigateWithWorkspace('arsip-drive')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-semibold text-xs hover:bg-amber-50 hover:border-amber-400 flex items-center gap-1.5 transition-colors"
                >
                  <FolderSync className="w-3.5 h-3.5 text-amber-600" />
                  <span>Arsip Dokumen Drive ({data.submittedDocsCount})</span>
                </button>
              </div>
            </div>

            {/* Dua Kolom: Perangkat Pembelajaran vs Perangkat Evaluasi */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Kolom A: Perangkat Pembelajaran */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/35 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-950">
                      Perangkat Pembelajaran
                    </h5>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                    Fase {selectedSlot.phase} · {selectedSlot.className}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-amber-400 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900 font-mono text-xs">CP</span>
                        <span className="text-slate-700 font-medium">
                          Capaian Pembelajaran {selectedSubjectGroup.subjectName}
                        </span>
                      </div>
                      <button
                        onClick={() => navigateWithWorkspace('cp')}
                        className="text-[11px] font-bold text-emerald-950 hover:bg-amber-400 bg-emerald-100 hover:text-emerald-950 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <span>Kelola CP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Elemen kompetensi Fase {selectedSlot.phase} untuk {selectedSlot.className}.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-amber-400 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900 font-mono text-xs">TP</span>
                        <span className="text-slate-700 font-medium">Tujuan Pembelajaran</span>
                      </div>
                      <button
                        onClick={() => navigateWithWorkspace('tp')}
                        className="text-[11px] font-bold text-emerald-950 hover:bg-amber-400 bg-emerald-100 hover:text-emerald-950 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <span>Kelola TP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Target kompetensi peserta didik terhubung dengan asesmen &amp; leger nilai.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-amber-400 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900 font-mono text-xs">ATP</span>
                        <span className="text-slate-700 font-medium">Alur Tujuan Pembelajaran</span>
                      </div>
                      <button
                        onClick={() => navigateWithWorkspace('atp')}
                        className="text-[11px] font-bold text-emerald-950 hover:bg-amber-400 bg-emerald-100 hover:text-emerald-950 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <span>Kelola ATP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Urutan sekuensial materi ajar Semester {data.semesterName} TP {data.academicYearName}.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-amber-400 transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900 font-mono text-xs">Modul &amp; LKPD</span>
                        <span className="text-slate-700 font-medium">Perangkat Harian</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => navigateWithWorkspace('modul-ajar')}
                          className="text-[10px] font-bold text-emerald-950 bg-emerald-100 hover:bg-amber-300 px-2 py-1 rounded transition-colors"
                        >
                          Modul Ajar
                        </button>
                        <button
                          onClick={() => navigateWithWorkspace('lkpd')}
                          className="text-[10px] font-bold text-emerald-950 bg-emerald-100 hover:bg-amber-300 px-2 py-1 rounded transition-colors"
                        >
                          LKPD
                        </button>
                        <button
                          onClick={() => navigateWithWorkspace('arsip-drive')}
                          className="text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-amber-100 px-2 py-1 rounded transition-colors"
                        >
                          Drive
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {data.approvedDocsCount} disetujui · {data.revisionDocsCount} perlu revisi.
                    </p>
                  </div>
                </div>
              </div>

              {/* Kolom B: Perangkat Evaluasi */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/35 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-950">
                      Perangkat Evaluasi (per Lingkup Materi)
                    </h5>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-950 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                    KKTP: {data.kktpDefault}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {scopeConfigs.length === 0 ? (
                    <div className="p-4 rounded-xl bg-white border border-dashed border-emerald-300 text-center space-y-2">
                      <p className="font-bold text-slate-800 text-xs">
                        Perangkat Evaluasi Belum Diisi
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Anda belum menambahkan Lingkup Materi (LM) untuk mapel ini. Tambahkan Lingkup Materi baru atau muat preset untuk menyusun kisi-kisi &amp; bank soal.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateWithWorkspace('kisi-kisi')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 font-bold text-[11px] transition-colors shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Tambah Lingkup Materi</span>
                      </button>
                    </div>
                  ) : (
                    scopeConfigs.map((sc) => {
                      const viewMap: Record<string, string> = {
                        LM1: 'eval-lm1',
                        LM2: 'eval-lm2',
                        STS: 'eval-sts',
                        LM3: 'eval-lm3',
                        LM4: 'eval-lm4',
                        SAS: 'eval-sas',
                      };
                      const targetView = viewMap[sc.scope_key] || `eval-scope:${sc.scope_key}`;
                      return (
                        <div
                          key={sc.id}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                            sc.is_special_summative
                              ? sc.scope_key === 'STS'
                                ? 'bg-amber-50/80 border-amber-300'
                                : 'bg-emerald-50/90 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-bold font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                  sc.scope_key === 'STS'
                                    ? 'bg-amber-400 text-emerald-950 font-extrabold'
                                    : sc.scope_key === 'SAS'
                                    ? 'bg-emerald-900 text-amber-300 font-extrabold'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                {sc.code}
                              </span>
                              <span className="text-slate-800 font-semibold text-xs truncate">
                                {sc.title}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                              TP: {sc.associated_tps.length > 0 ? sc.associated_tps.join(', ') : '-'}
                            </p>
                          </div>
                          <button
                            onClick={() => navigateWithWorkspace(targetView)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 transition-colors ${
                              sc.scope_key === 'STS'
                                ? 'bg-amber-400 hover:bg-amber-500 text-emerald-950'
                                : sc.scope_key === 'SAS'
                                ? 'bg-emerald-900 hover:bg-emerald-950 text-amber-300'
                                : 'bg-emerald-50 hover:bg-amber-100 text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            Buka {sc.code}
                          </button>
                        </div>
                      );
                    })
                  )}

                  <div className="pt-1.5 border-t border-emerald-200/70 flex items-center justify-between text-xs flex-wrap gap-2">
                    <button
                      onClick={() => navigateWithWorkspace('asesmen-nilai')}
                      className="text-emerald-800 hover:text-amber-700 font-bold flex items-center gap-1"
                    >
                      <span>Buku Nilai</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigateWithWorkspace('remedial-pengayaan')}
                        className="text-[10px] font-semibold text-emerald-900 bg-emerald-100 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors"
                      >
                        Remedial
                      </button>
                      <button
                        onClick={() => navigateWithWorkspace('analisis-nilai')}
                        className="text-[10px] font-semibold text-emerald-900 bg-emerald-100 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors"
                      >
                        Analisis
                      </button>
                      <button
                        onClick={() => navigateWithWorkspace('leger-nilai')}
                        className="text-[10px] font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 px-2 py-0.5 rounded"
                      >
                        Leger Rapor
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Menu Khusus Ko Kurikuler */}
      <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-amber-300/70 text-emerald-800 shrink-0">
              <Compass className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                  Menu Khusus Ko Kurikuler
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-emerald-950 border border-amber-300">
                  4 Sub Menu Terintegrasi Drive
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengelolaan program kokurikuler madrasah: perencanaan, bahan ajar, asesmen &amp; refleksi, hingga administrasi dan pelaporan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateWithWorkspace('kokurikuler-perencanaan')}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold text-xs hover:from-amber-500 hover:to-yellow-500 transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-center shrink-0"
          >
            <span>Buka Modul Ko Kurikuler</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-emerald-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-emerald-50/80 text-emerald-950 border-b border-emerald-200">
              <tr>
                <th className="px-3.5 py-2.5 font-bold w-10">No</th>
                <th className="px-3.5 py-2.5 font-bold">Sub Menu Ko Kurikuler</th>
                <th className="px-3.5 py-2.5 font-bold hidden md:table-cell">Cakupan Dokumen &amp; Aktivitas</th>
                <th className="px-3.5 py-2.5 font-bold text-center w-28">Tersimpan</th>
                <th className="px-3.5 py-2.5 font-bold text-right w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {KOKURIKULER_SUBMENUS.map((sub, idx) => {
                const subIcons: Record<KoKurikulerSubMenu, React.ComponentType<{ className?: string }>> = {
                  perencanaan: Compass,
                  'bahan-ajar': BookOpen,
                  asesmen: ClipboardCheck,
                  administrasi: FileArchive,
                };
                const SubIcon = subIcons[sub.key];
                const count = koKurikulerCounts[sub.key] || 0;

                return (
                  <tr key={sub.key} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="px-3.5 py-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 shrink-0">
                          <SubIcon className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{sub.label}</p>
                          <p className="text-[10px] text-slate-500 md:hidden line-clamp-1">{sub.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 hidden md:table-cell">{sub.description}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                        {count} Berkas
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigateWithWorkspace(sub.viewId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-300 font-bold text-[11px] transition-colors"
                      >
                        <span>Kelola</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jurnal Mengajar & Riwayat Supervisi Real */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-700" />
                <h4 className="font-bold text-sm text-slate-900">Jurnal Mengajar Harian</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-emerald-950 border border-amber-200">
                {data.journalsCount} Catatan
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Daftar kegiatan tatap muka KBM, capaian materi, dan refleksi pembelajaran yang dapat diekspor ke CSV dan PDF.
            </p>

            {data.recentJournals.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs text-slate-500 text-center">
                Belum ada catatan jurnal mengajar untuk akun Anda.
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentJournals.slice(0, 3).map((jrn) => (
                  <div key={jrn.id} className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span className="font-bold text-emerald-900">
                        {jrn.className} · {jrn.subjectName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{jrn.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium mt-1 line-clamp-2">
                      {jrn.topic}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => navigateWithWorkspace('jurnal-mengajar')}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold text-xs hover:from-amber-500 hover:to-yellow-500 transition-colors flex items-center gap-1.5 shadow-xs w-full justify-center"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Buka Tabel Jurnal &amp; Ekspor</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-sm text-slate-900">Riwayat Supervisi Guru</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200">
                Tabel &amp; Ekspor
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Hasil observasi langsung Kepala Madrasah: skor instrumen, catatan pembinaan, dan rencana tindak lanjut.
            </p>

            {data.recentSupervision ? (
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      Supervisi {data.recentSupervision.subjectName} ({data.recentSupervision.className})
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Supervisor: {data.recentSupervision.supervisorName} · {data.recentSupervision.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-emerald-800 font-mono">
                      {data.recentSupervision.totalScore}
                    </span>
                    <p className="text-[10px] font-bold text-amber-700">
                      {data.recentSupervision.predicate}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 italic border-t border-emerald-200/60 pt-2">
                  &ldquo;{data.recentSupervision.recommendations}&rdquo;
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs text-slate-500 text-center">
                Belum ada riwayat supervisi akademik yang tercatat untuk akun Anda.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => navigateWithWorkspace('supervisi-guru')}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold text-xs hover:from-amber-500 hover:to-yellow-500 transition-colors flex items-center gap-1.5 shadow-xs w-full justify-center"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Buka Tabel Supervisi &amp; Ekspor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

