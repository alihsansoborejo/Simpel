import React, { useState, useEffect } from 'react';
import { supervisionService } from '../../services/supervisionService';
import { academicService } from '../../services/academicService';
import {
  SupervisionRecord,
  Teacher,
  ClassRoom,
  Subject,
  FollowupStatus,
  SystemSettings,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Award,
  Plus,
  Download,
  Printer,
  Search,
  CheckCircle,
  Clock,
  Sparkles,
  Heart,
  ChevronRight,
  UserCheck,
  Filter,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';

export const SupervisionPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [records, setRecords] = useState<SupervisionRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string>('');
  const [activeAcademicYearName, setActiveAcademicYearName] = useState<string>('2025/2026');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('');
  const [activeSemesterType, setActiveSemesterType] = useState<string>('Ganjil');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<SupervisionRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State: Formulir Supervisi Baru Langsung di Aplikasi
  const [teacherId, setTeacherId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [supervisionDate, setSupervisionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [topic, setTopic] = useState<string>('');
  const [aspectPlanning, setAspectPlanning] = useState<string>('');
  const [aspectExecution, setAspectExecution] = useState<string>('');
  const [aspectAssessment, setAspectAssessment] = useState<string>('');
  const [aspectClassroom, setAspectClassroom] = useState<string>('');
  const [deepLearningNotes, setDeepLearningNotes] = useState<string>('');
  const [loveCurriculumNotes, setLoveCurriculumNotes] = useState<string>('');
  const [strengths, setStrengths] = useState<string>('');
  const [areasImprovement, setAreasImprovement] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string>('');
  const [actionPlan, setActionPlan] = useState<string>('');
  const [totalScore, setTotalScore] = useState<number>(90);

  const isTeacherScoped = activeRole === 'guru' || activeRole === 'wali_kelas';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recs, tchs, clss, sbjs, sysSettings, years, sems, teacher] = await Promise.all([
        supervisionService.getRecords(),
        academicService.getTeachers(),
        academicService.getClasses(),
        academicService.getSubjects(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
      ]);

      setResolvedTeacher(teacher);
      setSettings(sysSettings);

      const activeYear =
        years.find((y) => y.id === sysSettings.active_academic_year_id) ||
        years.find((y) => y.is_active) ||
        years[0];
      const activeSem =
        sems.find((s) => s.id === sysSettings.active_semester_id) ||
        sems.find((s) => s.is_active) ||
        sems[0];

      setActiveAcademicYearId(activeYear?.id || '');
      if (activeYear?.name) setActiveAcademicYearName(activeYear.name);
      setActiveSemesterId(activeSem?.id || '');
      if (activeSem?.semester_type) setActiveSemesterType(activeSem.semester_type);

      const scopedRecs = isTeacherScoped
        ? teacher
          ? recs.filter((r) => r.teacher_id === teacher.id)
          : []
        : recs;

      const scopedTeachers = isTeacherScoped ? (teacher ? [teacher] : []) : tchs;

      setRecords(scopedRecs);
      setTeachers(scopedTeachers);
      if (isTeacherScoped && teacher) {
        setTeacherFilter(teacher.id);
      }
      setClasses(clss);
      setSubjects(sbjs);
      if (scopedTeachers.length > 0 && !teacherId) setTeacherId(scopedTeachers[0].id);
      if (clss.length > 0 && !classId) setClassId(clss[0].id);
      if (sbjs.length > 0 && !subjectId) setSubjectId(sbjs[0].id);
    } catch (err) {
      console.error('Gagal memuat data supervisi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeRole, user?.id]);

  useRealtimeSync(
    [
      'simpel_supervision_records',
      'simpel_supervision_instruments',
      'simpel_teachers',
      'simpel_classes',
      'simpel_subjects',
      'simpel_settings',
      'simpel_academic_years',
      'simpel_semesters',
    ],
    () => {
      void loadData();
    }
  );

  const calculatePredicate = (score: number): string => {
    if (score >= 91) return 'Amat Baik';
    if (score >= 81) return 'Baik';
    if (score >= 71) return 'Cukup';
    return 'Kurang';
  };

  const handleCreateSupervision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pred = calculatePredicate(totalScore);
      await supervisionService.createRecord({
        instrument_id: 'ins-1',
        teacher_id: teacherId,
        supervisor_id: user?.id || '',
        academic_year_id: activeAcademicYearId || 'ay-2026',
        semester_id: activeSemesterId || 'sem-ganjil-2026',
        class_id: classId,
        subject_id: subjectId,
        assignment_id: null,
        supervision_date: supervisionDate,
        supervision_type: 'Pelaksanaan_KBM',
        topic,
        aspect_planning_notes: aspectPlanning,
        aspect_execution_notes: aspectExecution,
        aspect_assessment_notes: aspectAssessment,
        aspect_classroom_management_notes: aspectClassroom,
        deep_learning_implementation_notes: deepLearningNotes,
        love_based_curriculum_notes: loveCurriculumNotes,
        general_observation_notes: `Observasi KBM oleh Kepala Madrasah pada topik ${topic}`,
        strengths,
        areas_for_improvement: areasImprovement,
        recommendations,
        action_plan_summary: actionPlan,
        total_score: totalScore,
        max_possible_score: 100,
        percentage_score: totalScore,
        predicate: pred,
        is_finalized: true,
        is_shared_with_teacher: true,
        teacher_feedback: null,
        teacher_acknowledged_at: null,
      });

      setShowFormModal(false);
      setStatusMessage('Data formulir supervisi akademik berhasil disimpan ke database.');
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan supervisi:', err);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesTeacher = teacherFilter === 'all' || r.teacher_id === teacherFilter;
    const matchesSearch =
      r.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.teacher?.full_name && r.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.predicate && r.predicate.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTeacher && matchesSearch;
  });

  // Ekspor ke CSV / Excel
  const exportToCSV = () => {
    const headers = [
      'No',
      'Tanggal Supervisi',
      'Nama Guru',
      'Kelas',
      'Mata Pelajaran',
      'Materi / Topik Observasi',
      'Skor Total (%)',
      'Predikat',
      'Kelebihan Guru',
      'Hal Perlu Ditingkatkan',
      'Rekomendasi Kepala Madrasah',
      'Rencana Tindak Lanjut',
      'Status Tindak Lanjut',
    ];

    const rows = filteredRecords.map((r, idx) => {
      const followupStatus =
        r.followups && r.followups.length > 0 ? r.followups[0].status.replace('_', ' ') : 'Proses';
      return [
        idx + 1,
        r.supervision_date,
        `"${r.teacher?.full_name || 'Guru'}"`,
        `"${r.class?.name || '-'}"`,
        `"${r.subject?.name || '-'}"`,
        `"${r.topic.replace(/"/g, '""')}"`,
        r.percentage_score || r.total_score || 0,
        `"${r.predicate || 'Baik'}"`,
        `"${(r.strengths || '').replace(/"/g, '""')}"`,
        `"${(r.areas_for_improvement || '').replace(/"/g, '""')}"`,
        `"${(r.recommendations || '').replace(/"/g, '""')}"`,
        `"${(r.action_plan_summary || '').replace(/"/g, '""')}"`,
        `"${followupStatus}"`,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `rekap_supervisi_akademik_mi_al_ihsan_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const tableRows = filteredRecords.map((r, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${r.teacher ? `${r.teacher.title_prefix || ''} ${r.teacher.full_name} ${r.teacher.title_suffix || ''}`.trim() : 'Guru Madrasah'}</strong><br><small>NIP: ${r.teacher?.nip || '-'}</small></td>
        <td>${r.subject ? r.subject.name : '-'}</td>
        <td class="center">${r.class ? r.class.name : '-'}</td>
        <td class="center">${r.supervision_date}</td>
        <td class="center font-bold" style="font-size:11pt;color:#047857;">${r.total_score}</td>
        <td class="center font-bold">${r.predicate}</td>
        <td><strong>Catatan:</strong> ${r.general_observation_notes || r.aspect_execution_notes || r.topic || '-'}<br><strong>Rekomendasi:</strong> ${r.recommendations || '-'}</td>
      </tr>
    `).join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">No</th>
            <th>Nama Guru yang Disupervisi</th>
            <th>Mata Pelajaran</th>
            <th style="width: 65px;">Kelas</th>
            <th style="width: 80px;">Tanggal</th>
            <th style="width: 50px;">Nilai</th>
            <th style="width: 85px;">Predikat</th>
            <th>Catatan & Arahan Pembinaan</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    const leftSignerName = resolvedTeacher
      ? `${resolvedTeacher.title_prefix || ''} ${resolvedTeacher.full_name} ${resolvedTeacher.title_suffix || ''}`.trim()
      : user?.profile?.full_name || 'Tim Penilai Madrasah';

    printDocumentDirectly(contentHtml, {
      title: 'REKAPITULASI HASIL SUPERVISI AKADEMIK & KBM',
      subtitle: 'Instrumen Observasi Pembelajaran Mendalam & Kurikulum Berbasis Cinta (KBC)',
      schoolName: settings?.school_name,
      schoolAddress: settings?.address,
      logoUrl: settings?.logo_url || undefined,
      metadata: [
        { label: 'Tahun Pelajaran', value: `${activeAcademicYearName} (Semester ${activeSemesterType})` },
        { label: 'Sasaran Guru', value: `${filteredRecords.length} Tenaga Pendidik` },
        { label: 'Fokus Pendekatan', value: 'Deep Learning & Kurikulum Berbasis Cinta' },
        { label: 'Tanggal Dokumen', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: isTeacherScoped ? 'Guru yang Disupervisi,' : 'Tim Penilai / Koordinator Akademik,',
        leftName: leftSignerName,
        leftNip: resolvedTeacher?.nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Kepala Madrasah,',
        rightName: settings?.principal_name || 'Kepala Madrasah',
        rightNip: settings?.principal_nip || '-',
      },
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Supervisi Pembelajaran & KBM (Formulir Langsung)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Instrumen penilaian langsung di aplikasi, observasi KBM mendalam, Kurikulum Berbasis Cinta, dan rekapitulasi yang dapat diekspor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Ekspor CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Unduh rekap tabel hasil supervisi ke Excel/CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel / CSV</span>
          </button>

          {/* Tombol Cetak / PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Cetak format formal laporan supervisi madrasah"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>

          {/* Tombol Supervisi Baru (Kamad & Admin) */}
          {(activeRole === 'kepala_madrasah' || activeRole === 'admin') && (
            <button
              onClick={() => {
                setTopic('');
                setAspectPlanning('');
                setAspectExecution('');
                setAspectAssessment('');
                setAspectClassroom('');
                setDeepLearningNotes('');
                setLoveCurriculumNotes('');
                setStrengths('');
                setAreasImprovement('');
                setRecommendations('');
                setActionPlan('');
                setTotalScore(90);
                setShowFormModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Input Formulir Supervisi</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200 print:hidden">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header Cetak Formal (Hanya tampil saat dicetak) */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h2 className="text-lg font-bold text-slate-900 uppercase">
          LAPORAN REKAPITULASI HASIL SUPERVISI AKADEMIK & PEMBELAJARAN
        </h2>
        <h3 className="text-sm font-semibold text-slate-800">
          {settings?.school_name || "MI MA'ARIF AL IHSAN SOBOREJO"} · TAHUN PELAJARAN {activeAcademicYearName}
        </h3>
        <p className="text-xs text-slate-600 mt-0.5">
          {settings?.address || 'Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah'} · Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}
        </p>
      </div>

      {/* Toolbar Filter & Pencarian */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        {!isTeacherScoped ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Filter Guru:</span>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
            >
              <option value="all">Seluruh Dewan Guru</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title_prefix ? `${t.title_prefix} ` : ''}
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            Menampilkan hasil supervisi untuk: {resolvedTeacher?.full_name || user?.profile?.full_name || 'Guru Aktif'}
          </div>
        )}

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari guru, materi, atau predikat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>
      </div>

      {/* Tabel / List Hasil Supervisi (Exportable & Printable) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-3 px-3.5 w-10 text-center font-mono">No</th>
                <th className="py-3 px-3.5 w-24">Tanggal</th>
                <th className="py-3 px-3.5 w-44">Guru yang Disupervisi</th>
                <th className="py-3 px-3.5 w-36">Kelas & Mapel</th>
                <th className="py-3 px-3.5 w-44">Topik Pembelajaran</th>
                <th className="py-3 px-3.5 w-24 text-center">Skor & Predikat</th>
                <th className="py-3 px-3.5">Rekomendasi & Kurikulum Cinta</th>
                <th className="py-3 px-3.5 w-28 text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Memuat data hasil supervisi...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Belum ada catatan supervisi yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors align-top">
                    <td className="py-3 px-3.5 text-center font-mono tabular-nums text-slate-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3.5 font-mono tabular-nums text-slate-800 font-medium">
                      {r.supervision_date}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">
                        {r.teacher ? `${r.teacher.title_prefix || ''} ${r.teacher.full_name}` : 'Guru'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        NIP: {r.teacher?.nip || 'Non-PNS'}
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-slate-800">{r.class?.name || '-'}</div>
                      <div className="text-[11px] text-emerald-800 font-medium">
                        {r.subject?.name || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-medium text-slate-900 leading-snug">
                      {r.topic}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="font-bold font-mono tabular-nums text-emerald-900 text-sm">
                        {r.percentage_score || r.total_score}%
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {r.predicate || 'Baik'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 space-y-1">
                      <p className="text-slate-800 leading-relaxed line-clamp-2">
                        {r.recommendations}
                      </p>
                      {r.love_based_curriculum_notes && (
                        <div className="flex items-center gap-1 text-[11px] text-rose-700 italic">
                          <Heart className="w-3 h-3 shrink-0 fill-rose-500 text-rose-500" />
                          <span className="line-clamp-1">{r.love_based_curriculum_notes}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center print:hidden">
                      <button
                        onClick={() => setSelectedRecordDetail(r)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors"
                      >
                        Rincian
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bagian Tanda Tangan Cetak Formal (Hanya tampil saat dicetak) */}
      <div className="hidden print:grid grid-cols-2 gap-8 pt-8 text-xs text-center">
        <div>
          <p>Mengetahui,</p>
          <p className="font-bold">Kepala {settings?.school_name || "MI Ma'arif Al Ihsan Soborejo"}</p>
          <div className="h-16" />
          <p className="font-bold underline">{settings?.principal_name || 'Kepala Madrasah'}</p>
          <p className="font-mono">NIP. {settings?.principal_nip || '-'}</p>
        </div>
        <div>
          <p>Temanggung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="font-bold">{isTeacherScoped ? 'Guru yang Disupervisi' : 'Tim Penilai Akademik'}</p>
          <div className="h-16" />
          <p className="font-bold underline">
            {resolvedTeacher
              ? `${resolvedTeacher.title_prefix || ''} ${resolvedTeacher.full_name} ${resolvedTeacher.title_suffix || ''}`.trim()
              : user?.profile?.full_name || 'Tim Penilai'}
          </p>
          <p className="font-mono">NIP. {resolvedTeacher?.nip || '-'}</p>
        </div>
      </div>

      {/* Modal Detail Hasil Supervisi */}
      {selectedRecordDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rincian Lembar Observasi Supervisi Akademik
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Guru: {selectedRecordDetail.teacher?.full_name} · {selectedRecordDetail.supervision_date}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold font-mono tabular-nums text-emerald-900">
                  {selectedRecordDetail.percentage_score || selectedRecordDetail.total_score}%
                </span>
                <p className="text-[11px] font-bold text-emerald-800">{selectedRecordDetail.predicate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Kelas & Mapel:</span>
                <p className="font-bold text-slate-900">
                  {selectedRecordDetail.class?.name} · {selectedRecordDetail.subject?.name}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Materi Observasi:</span>
                <p className="font-bold text-slate-900">{selectedRecordDetail.topic}</p>
              </div>
            </div>

            {/* Aspek-Aspek Kualitatif */}
            <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
              {selectedRecordDetail.aspect_planning_notes && (
                <div>
                  <span className="font-bold text-slate-800">1. Aspek Perencanaan Pembelajaran:</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                    {selectedRecordDetail.aspect_planning_notes}
                  </p>
                </div>
              )}

              {selectedRecordDetail.aspect_execution_notes && (
                <div>
                  <span className="font-bold text-slate-800">2. Aspek Pelaksanaan KBM:</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                    {selectedRecordDetail.aspect_execution_notes}
                  </p>
                </div>
              )}

              {selectedRecordDetail.deep_learning_implementation_notes && (
                <div>
                  <div className="flex items-center gap-1 font-bold text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>3. Penerapan Pembelajaran Mendalam (Deep Learning):</span>
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-relaxed bg-emerald-50/50 p-2.5 rounded border border-emerald-100">
                    {selectedRecordDetail.deep_learning_implementation_notes}
                  </p>
                </div>
              )}

              {selectedRecordDetail.love_based_curriculum_notes && (
                <div>
                  <div className="flex items-center gap-1 font-bold text-rose-900">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>4. Penerapan Kurikulum Berbasis Cinta:</span>
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-relaxed bg-rose-50/50 p-2.5 rounded border border-rose-100">
                    {selectedRecordDetail.love_based_curriculum_notes}
                  </p>
                </div>
              )}

              {selectedRecordDetail.strengths && (
                <div>
                  <span className="font-bold text-slate-800">5. Kelebihan Guru:</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">{selectedRecordDetail.strengths}</p>
                </div>
              )}

              {selectedRecordDetail.areas_for_improvement && (
                <div>
                  <span className="font-bold text-slate-800">6. Hal yang Perlu Ditingkatkan:</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {selectedRecordDetail.areas_for_improvement}
                  </p>
                </div>
              )}

              {selectedRecordDetail.recommendations && (
                <div>
                  <span className="font-bold text-slate-800">7. Rekomendasi & Arahan Pembinaan:</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed font-medium">
                    {selectedRecordDetail.recommendations}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRecordDetail(null)}
                className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg shadow-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulir Supervisi Baru Langsung di Aplikasi */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 my-8 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Formulir Supervisi KBM Langsung di Aplikasi
            </h3>
            <p className="text-xs text-slate-500">
              Catat observasi KBM secara terstruktur tanpa perlu mengunggah file dokumen.
            </p>

            <form onSubmit={handleCreateSupervision} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Guru</label>
                  <select
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                    required
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title_prefix ? `${t.title_prefix} ` : ''}
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas & Mapel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full text-xs px-2 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                      required
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full text-xs px-2 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                      required
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Observasi</label>
                  <input
                    type="date"
                    value={supervisionDate}
                    onChange={(e) => setSupervisionDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Materi / Topik Pembelajaran</label>
                <input
                  type="text"
                  placeholder="Contoh: Teks Narasi Kasih Sayang & Menulis Terbimbing"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Aspek Perencanaan Pembelajaran</label>
                  <textarea
                    rows={2}
                    placeholder="Kesesuaian modul ajar dengan TP..."
                    value={aspectPlanning}
                    onChange={(e) => setAspectPlanning(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Aspek Pelaksanaan KBM</label>
                  <textarea
                    rows={2}
                    placeholder="Kondusivitas kelas dan interaksi siswa..."
                    value={aspectExecution}
                    onChange={(e) => setAspectExecution(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Penerapan Pembelajaran Mendalam (Deep Learning)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Bagaimana siswa diajak bernalar kritis dan bermakna..."
                    value={deepLearningNotes}
                    onChange={(e) => setDeepLearningNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Penerapan Kurikulum Berbasis Cinta
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Kehangatan komunikasi, kasih sayang, dan penguatan adab..."
                    value={loveCurriculumNotes}
                    onChange={(e) => setLoveCurriculumNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kelebihan Guru</label>
                  <textarea
                    rows={2}
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hal yang Perlu Ditingkatkan</label>
                  <textarea
                    rows={2}
                    value={areasImprovement}
                    onChange={(e) => setAreasImprovement(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rekomendasi & Arahan Kepala Madrasah</label>
                <textarea
                  rows={2}
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Skor Kuantitatif (0 - 100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={totalScore}
                    onChange={(e) => setTotalScore(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Predikat Otomatis</label>
                  <input
                    type="text"
                    disabled
                    value={calculatePredicate(totalScore)}
                    className="w-full text-xs font-bold px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-emerald-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Hasil Supervisi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
