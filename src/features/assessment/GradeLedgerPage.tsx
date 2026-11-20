import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { reportService, StudentSubjectScore, ClassLegerRow } from '../../services/reportService';
import {
  ClassRoom,
  Subject,
  Teacher,
  TeachingAssignment,
  SystemSettings,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync, notifyDomFormSaved } from '../../hooks/useRealtimeSync';
import {
  FileSpreadsheet,
  Award,
  BookOpen,
  School,
  Save,
  Printer,
  Download,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Edit3,
  RotateCcw,
} from 'lucide-react';

interface GradeLedgerPageProps {
  onNavigate?: (view: string) => void;
}

export const GradeLedgerPage: React.FC<GradeLedgerPageProps> = ({ onNavigate }) => {
  const { user, activeRole } = useAuth();
  const {
    selectedClassId: wsClassId,
    selectedSubjectId: wsSubjectId,
    setWorkspaceSelection,
  } = useWorkspace();

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeYearName, setActiveYearName] = useState<string>('2025/2026');
  const [activeSemesterType, setActiveSemesterType] = useState<string>('Ganjil');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'per-mapel' | 'rekap-kelas'>('per-mapel');

  // Data States
  const [subjectScores, setSubjectScores] = useState<StudentSubjectScore[]>([]);
  const [overallRows, setOverallRows] = useState<ClassLegerRow[]>([]);
  const [overallSubjects, setOverallSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [editingDescStudentId, setEditingDescStudentId] = useState<string | null>(null);
  const isLedgerDirtyRef = useRef<boolean>(false);

  const isTeacherRole = activeRole === 'guru';
  const isHomeroomRole = activeRole === 'wali_kelas';
  const canViewOverallClass = ['wali_kelas', 'admin', 'kepala_madrasah'].includes(activeRole);

  const loadBaseData = async () => {
    try {
      const [clss, sbjs, asgs, sysSettings, years, sems, teacher, tchs] = await Promise.all([
        academicService.getClasses(),
        academicService.getSubjects(),
        academicService.getTeachingAssignments(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
        academicService.getTeachers(),
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

      if (activeYear?.name) setActiveYearName(activeYear.name);
      if (activeSem?.semester_type) setActiveSemesterType(activeSem.semester_type);

      const teacherAsgs = isTeacherRole
        ? academicService.filterAssignmentsForUser(asgs, user, teacher, tchs)
        : asgs;
      setAssignments(teacherAsgs);

      let scopedClasses = clss;
      let scopedSubjects = sbjs;

      if (isTeacherRole) {
        const assignedClassIds = new Set(teacherAsgs.map((a) => a.class_id));
        const assignedSubjectIds = new Set(teacherAsgs.map((a) => a.subject_id));
        const extraClasses = teacherAsgs
          .map((a) => a.class)
          .filter((c): c is ClassRoom => Boolean(c && !clss.some((mc) => mc.id === c.id)));
        const extraSubjects = teacherAsgs
          .map((a) => a.subject)
          .filter((s): s is Subject => Boolean(s && !sbjs.some((ms) => ms.id === s.id)));
        const mergedClasses = [...clss, ...extraClasses];
        const mergedSubjects = [...sbjs, ...extraSubjects];
        scopedClasses = mergedClasses.filter((c) => assignedClassIds.has(c.id));
        scopedSubjects = mergedSubjects.filter((s) => assignedSubjectIds.has(s.id));
        setViewMode('per-mapel');
      } else if (isHomeroomRole) {
        const homeroomClass = await academicService.resolveHomeroomClassForUser(user, teacher);
        scopedClasses = homeroomClass ? [homeroomClass] : [];
      }

      setClasses(scopedClasses);
      setSubjects(scopedSubjects);

      const targetClass =
        (wsClassId && scopedClasses.some((c) => c.id === wsClassId) ? wsClassId : '') ||
        (selectedClassId && scopedClasses.some((c) => c.id === selectedClassId)
          ? selectedClassId
          : '') ||
        scopedClasses[0]?.id ||
        '';

      setSelectedClassId(targetClass);

      const validSubjectsForClass = isTeacherRole
        ? scopedSubjects.filter((s) =>
            teacherAsgs.some((a) => a.class_id === targetClass && a.subject_id === s.id)
          )
        : scopedSubjects;

      const targetSubject =
        (wsSubjectId && validSubjectsForClass.some((s) => s.id === wsSubjectId)
          ? wsSubjectId
          : '') ||
        (selectedSubjectId && validSubjectsForClass.some((s) => s.id === selectedSubjectId)
          ? selectedSubjectId
          : '') ||
        validSubjectsForClass[0]?.id ||
        '';

      setSelectedSubjectId(targetSubject);

      if (!targetClass || (viewMode === 'per-mapel' && !targetSubject)) {
        setSubjectScores([]);
        setOverallRows([]);
        setOverallSubjects([]);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Gagal memuat basis data leger:', err);
      setIsLoading(false);
    }
  };

  const loadLedgerData = async (silent = false) => {
    if (!selectedClassId || (viewMode === 'per-mapel' && !selectedSubjectId)) {
      setSubjectScores([]);
      setOverallRows([]);
      setOverallSubjects([]);
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    try {
      setIsLocked(reportService.isReportCardLocked(selectedClassId));

      if (viewMode === 'per-mapel') {
        if (!silent || !isLedgerDirtyRef.current) {
          const scores = await reportService.getSubjectLedger(selectedClassId, selectedSubjectId);
          setSubjectScores(scores);
        }
      } else {
        const { subjects: sbjs, rows } = await reportService.getClassOverallLedger(selectedClassId);
        setOverallSubjects(sbjs);
        setOverallRows(rows);
      }
    } catch (err) {
      console.error('Gagal memuat data leger nilai:', err);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, [activeRole, user?.id, user?.email, user?.teacherId, user?.profile?.full_name]);

  // Sinkronkan ketika pilihan dari Sidebar/Dashboard berubah
  useEffect(() => {
    if (wsClassId && classes.some((c) => c.id === wsClassId) && wsClassId !== selectedClassId) {
      setSelectedClassId(wsClassId);
    }
    if (wsSubjectId) {
      const allowedForWsClass = isTeacherRole
        ? subjects.filter((s) =>
            assignments.some(
              (a) => a.class_id === (wsClassId || selectedClassId) && a.subject_id === s.id
            )
          )
        : subjects;
      if (allowedForWsClass.some((s) => s.id === wsSubjectId) && wsSubjectId !== selectedSubjectId) {
        setSelectedSubjectId(wsSubjectId);
      }
    }
  }, [wsClassId, wsSubjectId, classes, subjects, assignments]);

  useEffect(() => {
    isLedgerDirtyRef.current = false;
    if (selectedClassId && (viewMode === 'rekap-kelas' || selectedSubjectId)) {
      void loadLedgerData(false);
    } else {
      setSubjectScores([]);
      setOverallRows([]);
      setIsLoading(false);
    }
  }, [selectedClassId, selectedSubjectId, viewMode]);

  useRealtimeSync(
    [
      'simpel_subject_ledger_v1',
      'simpel_report_card_locks_v1',
      'simpel_assessments',
      'simpel_grades',
      'simpel_remedial',
      'simpel_students',
      'simpel_classes',
      'simpel_subjects',
      'simpel_class_members',
      'simpel_assignments',
      'simpel_teachers',
      'simpel_users_cache_v2',
      'simpel_homeroom_assignments',
      'simpel_settings',
      'simpel_academic_years',
      'simpel_semesters',
    ],
    () => {
      void loadBaseData().then(() => {
        if (selectedClassId && (viewMode === 'rekap-kelas' || selectedSubjectId)) {
          void loadLedgerData(true);
        }
      });
    }
  );

  // Handle Score Change
  const handleScoreChange = (
    studentId: string,
    field: 'lm1' | 'lm2' | 'lm3' | 'lm4' | 'stsScore' | 'sasScore',
    value: number
  ) => {
    if (isLocked) return;
    isLedgerDirtyRef.current = true;

    const kktpVal = Number(settings?.kktp_default ?? 75);
    const subjName =
      availableSubjectsForClass.find((s) => s.id === selectedSubjectId)?.name ||
      subjects.find((s) => s.id === selectedSubjectId)?.name ||
      'Mata Pelajaran';
    const clsLevel = classes.find((c) => c.id === selectedClassId)?.level || 4;

    setSubjectScores((prev) =>
      prev.map((item) => {
        if (item.studentId !== studentId) return item;

        const newLm = { ...item.lmScores };
        let newSts = item.stsScore;
        let newSas = item.sasScore;
        const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

        if (field === 'stsScore') newSts = safeValue;
        else if (field === 'sasScore') newSas = safeValue;
        else newLm[field] = safeValue;

        const { avgLm, finalScore, predicate } = reportService.calculateFinalScore(
          newLm,
          newSts,
          newSas,
          kktpVal
        );

        const desc = reportService.buildCompetencyDescriptions({
          subjectId: selectedSubjectId,
          subjectName: subjName,
          classLevel: clsLevel,
          lmScores: newLm,
          stsScore: newSts,
          sasScore: newSas,
          finalScore,
          kktp: kktpVal,
        });

        return {
          ...item,
          lmScores: newLm,
          avgLm,
          stsScore: newSts,
          sasScore: newSas,
          finalScore,
          predicate,
          highestCompetency: item.isDescriptionCustom
            ? item.highestCompetency
            : desc.highestCompetency,
          lowestCompetency: item.isDescriptionCustom
            ? item.lowestCompetency
            : desc.lowestCompetency,
        };
      })
    );
  };

  const handleCustomDescChange = (
    studentId: string,
    field: 'highestCompetency' | 'lowestCompetency',
    text: string
  ) => {
    if (isLocked) return;
    isLedgerDirtyRef.current = true;
    setSubjectScores((prev) =>
      prev.map((item) =>
        item.studentId === studentId
          ? { ...item, [field]: text, isDescriptionCustom: true }
          : item
      )
    );
  };

  const handleResetStudentDesc = (studentId: string) => {
    if (isLocked) return;
    isLedgerDirtyRef.current = true;
    const kktpVal = Number(settings?.kktp_default ?? 75);
    const subjName =
      availableSubjectsForClass.find((s) => s.id === selectedSubjectId)?.name ||
      subjects.find((s) => s.id === selectedSubjectId)?.name ||
      'Mata Pelajaran';
    const clsLevel = classes.find((c) => c.id === selectedClassId)?.level || 4;

    setSubjectScores((prev) =>
      prev.map((item) => {
        if (item.studentId !== studentId) return item;
        const desc = reportService.buildCompetencyDescriptions({
          subjectId: selectedSubjectId,
          subjectName: subjName,
          classLevel: clsLevel,
          lmScores: item.lmScores,
          stsScore: item.stsScore,
          sasScore: item.sasScore,
          finalScore: item.finalScore,
          kktp: kktpVal,
        });
        return {
          ...item,
          highestCompetency: desc.highestCompetency,
          lowestCompetency: desc.lowestCompetency,
          isDescriptionCustom: false,
        };
      })
    );
    setEditingDescStudentId(null);
  };

  const handleRegenerateAllDescriptions = async () => {
    if (isLocked || subjectScores.length === 0) return;
    const kktpVal = Number(settings?.kktp_default ?? 75);
    const subjName =
      availableSubjectsForClass.find((s) => s.id === selectedSubjectId)?.name ||
      subjects.find((s) => s.id === selectedSubjectId)?.name ||
      'Mata Pelajaran';
    const clsLevel = classes.find((c) => c.id === selectedClassId)?.level || 4;

    const regenerated = subjectScores.map((item) => {
      const { avgLm, finalScore, predicate } = reportService.calculateFinalScore(
        item.lmScores,
        item.stsScore,
        item.sasScore,
        kktpVal
      );
      const desc = reportService.buildCompetencyDescriptions({
        subjectId: selectedSubjectId,
        subjectName: subjName,
        classLevel: clsLevel,
        lmScores: item.lmScores,
        stsScore: item.stsScore,
        sasScore: item.sasScore,
        finalScore,
        kktp: kktpVal,
      });
      return {
        ...item,
        avgLm,
        finalScore,
        predicate,
        highestCompetency: desc.highestCompetency,
        lowestCompetency: desc.lowestCompetency,
        isDescriptionCustom: false,
      };
    });

    setSubjectScores(regenerated);
    setEditingDescStudentId(null);
    await reportService.saveSubjectLedger(selectedClassId, selectedSubjectId, regenerated, false);
    isLedgerDirtyRef.current = false;
    notifyDomFormSaved();
    setStatusMessage('Rumusan Capaian Kompetensi seluruh siswa telah disinkronkan ulang sesuai nilai perolehan.');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Simpan Perubahan Leger
  const handleSaveLedger = async () => {
    setIsSaving(true);
    try {
      await reportService.saveSubjectLedger(selectedClassId, selectedSubjectId, subjectScores, true);
      isLedgerDirtyRef.current = false;
      notifyDomFormSaved();
      setStatusMessage('Data nilai leger mata pelajaran berhasil disimpan dan siap masuk ke Buku Rapor.');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menyimpan leger:', err);
      setStatusMessage('Gagal menyimpan perubahan leger nilai.');
    } finally {
      setIsSaving(false);
    }
  };

  // Tarik Nilai Terbaru dari Daftar Nilai & Remedial
  const handlePullFromGrades = async () => {
    if (!selectedClassId || !selectedSubjectId || isLocked) return;
    setIsSaving(true);
    try {
      const { updatedStudents, filledSlots } = await reportService.syncFromAssessmentsForSubject(
        selectedClassId,
        selectedSubjectId,
        { forceOverwrite: true }
      );
      await loadLedgerData();
      if (filledSlots > 0) {
        setStatusMessage(
          `Berhasil menarik ${filledSlots} entri nilai untuk ${updatedStudents} siswa dari Daftar Nilai & Remedial ke Leger.`
        );
      } else {
        setStatusMessage('Belum ada nilai Sumatif/Unit tersimpan pada Daftar Nilai untuk mapel & rombel ini.');
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Gagal menarik nilai dari Daftar Nilai:', err);
      setStatusMessage('Gagal menyinkronkan nilai dari Daftar Nilai.');
    } finally {
      setIsSaving(false);
    }
  };

  // Kunci Rapor
  const handleToggleLock = () => {
    const nextState = !isLocked;
    reportService.setReportCardLock(selectedClassId, nextState);
    setIsLocked(nextState);
    setStatusMessage(
      nextState
        ? 'Buku Rapor kelas ini telah DIKUNCI untuk penerbitan resmi.'
        : 'Kunci Buku Rapor dibuka. Guru dapat memperbarui nilai.'
    );
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const availableSubjectsForClass = isTeacherRole
    ? subjects.filter((s) =>
        assignments.some((a) => a.class_id === selectedClassId && a.subject_id === s.id)
      )
    : subjects;

  const handleClassChange = (nextClassId: string) => {
    setSelectedClassId(nextClassId);
    const nextCls = classes.find((c) => c.id === nextClassId);
    const validSubjs = isTeacherRole
      ? subjects.filter((s) =>
          assignments.some((a) => a.class_id === nextClassId && a.subject_id === s.id)
        )
      : subjects;
    const nextSubjId = validSubjs.some((s) => s.id === selectedSubjectId)
      ? selectedSubjectId
      : validSubjs[0]?.id || '';
    if (nextSubjId !== selectedSubjectId) {
      setSelectedSubjectId(nextSubjId);
    }
    const matchedAsg = assignments.find(
      (a) => a.class_id === nextClassId && a.subject_id === nextSubjId
    );
    setWorkspaceSelection({
      classId: nextClassId || null,
      classLevel: nextCls?.level ?? null,
      subjectId: nextSubjId || null,
      assignmentId: matchedAsg?.id ?? null,
    });
  };

  const handleSubjectChange = (nextSubjectId: string) => {
    setSelectedSubjectId(nextSubjectId);
    const matchedAsg = assignments.find(
      (a) => a.class_id === selectedClassId && a.subject_id === nextSubjectId
    );
    setWorkspaceSelection({
      subjectId: nextSubjectId || null,
      assignmentId: matchedAsg?.id ?? null,
    });
  };

  const kktpDefault = Number(settings?.kktp_default ?? 75);

  const currentClass = classes.find((c) => c.id === selectedClassId) || {
    id: selectedClassId,
    name: selectedClassId ? 'Rombel Terpilih' : 'Belum Ada Rombel',
    level: 0,
    phase: 'B' as const,
  };

  const currentSubject = availableSubjectsForClass.find((s) => s.id === selectedSubjectId) ||
    subjects.find((s) => s.id === selectedSubjectId) || {
      id: selectedSubjectId,
      name: selectedSubjectId ? 'Mata Pelajaran' : 'Belum Ada Mapel',
      code: '-',
    };

  // Ekspor CSV
  const handleExportCSV = () => {
    if (viewMode === 'per-mapel') {
      const headers = [
        'No',
        'NIS',
        'Nama Lengkap',
        'LM 1 (TP 1)',
        'LM 2 (TP 2)',
        'LM 3 (TP 3)',
        'LM 4 (TP 4)',
        'Rata-rata LM/TP',
        'Sumatif Tengah Sem (STS)',
        'Sumatif Akhir Sem (SAS)',
        'Nilai Akhir Rapor',
        'Predikat',
        'Capaian Kompetensi Tertinggi',
        'Perlu Peningkatan',
      ];
      const rows = subjectScores.map((s, idx) => [
        idx + 1,
        s.nis,
        `"${s.studentName}"`,
        s.lmScores.lm1,
        s.lmScores.lm2,
        s.lmScores.lm3,
        s.lmScores.lm4,
        s.avgLm,
        s.stsScore,
        s.sasScore,
        s.finalScore,
        s.predicate,
        `"${s.highestCompetency}"`,
        `"${s.lowestCompetency}"`,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const safeYear = activeYearName.replace(/[\/\s]+/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `leger_nilai_${currentSubject.name.replace(/\s+/g, '_')}_${currentClass.name.replace(/\s+/g, '_')}_${safeYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const headers = [
        'Peringkat',
        'NIS',
        'Nama Lengkap',
        ...overallSubjects.map((sbj) => `"${sbj.name}"`),
        'Total Nilai',
        'Rata-rata Rapor',
      ];
      const rows = overallRows.map((r) => [
        r.rank,
        r.nis,
        `"${r.studentName}"`,
        ...overallSubjects.map((sbj) => r.subjectScores[sbj.id] || 0),
        r.totalScore,
        r.averageScore,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const safeYear = activeYearName.replace(/[\/\s]+/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `leger_rapor_kelas_${currentClass.name.replace(/\s+/g, '_')}_${safeYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Cetak Dokumen PDF Siap Cetak
  const handlePrintLedger = () => {
    let contentHtml = '';
    let docTitle = '';
    let docSubtitle = '';

    if (viewMode === 'per-mapel') {
      docTitle = `LEGER NILAI ASESMEN & RAPOR MATA PELAJARAN`;
      docSubtitle = `${currentSubject.name} - ${currentClass.name} (Fase ${currentClass.phase}) - Semester ${activeSemesterType} ${activeYearName}`;

      const rowsHtml = subjectScores.map((s, idx) => `
        <tr>
          <td class="center font-mono">${idx + 1}</td>
          <td class="center font-mono">${s.nis}</td>
          <td class="center"><strong>${s.studentName}</strong></td>
          <td class="center font-mono">${s.lmScores.lm1}</td>
          <td class="center font-mono">${s.lmScores.lm2}</td>
          <td class="center font-mono">${s.lmScores.lm3}</td>
          <td class="center font-mono">${s.lmScores.lm4}</td>
          <td class="center font-mono font-bold" style="background:#f8fafc;">${s.avgLm}</td>
          <td class="center font-mono">${s.stsScore}</td>
          <td class="center font-mono">${s.sasScore}</td>
          <td class="center font-mono font-bold" style="font-size:11pt;color:#047857;background:#ecfdf5;">${s.finalScore}</td>
          <td class="center font-bold">${s.predicate}</td>
          <td style="font-size:8pt;line-height:1.2;">
            <strong style="color:#047857;">Tercapai:</strong> ${s.highestCompetency}<br>
            <strong style="color:#b45309;">Perlu Peningkatan:</strong> ${s.lowestCompetency}
          </td>
        </tr>
      `).join('');

      contentHtml = `
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 25px;">No</th>
              <th rowspan="2" style="width: 55px;">NIS</th>
              <th rowspan="2">Nama Peserta Didik</th>
              <th colspan="4" class="center">Sumatif Lingkup Materi / TP</th>
              <th rowspan="2" style="width: 45px;">Rata LM</th>
              <th rowspan="2" style="width: 40px;">STS</th>
              <th rowspan="2" style="width: 40px;">SAS</th>
              <th rowspan="2" style="width: 45px;background:#047857;color:white;">Nilai Akhir</th>
              <th rowspan="2" style="width: 30px;">Pred</th>
              <th rowspan="2" style="width: 220px;">Capaian Kompetensi Buku Rapor</th>
            </tr>
            <tr>
              <th style="width: 35px;">LM 1</th>
              <th style="width: 35px;">LM 2</th>
              <th style="width: 35px;">LM 3</th>
              <th style="width: 35px;">LM 4</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } else {
      docTitle = `LEGER REKAPITULASI NILAI RAPOR ROMBONGAN BELAJAR`;
      docSubtitle = `${currentClass.name} (Fase ${currentClass.phase}) - Tahun Ajaran ${activeYearName}`;

      const headerCols = overallSubjects.map((s) => `<th style="width: 38px;" title="${s.name}">${s.code}</th>`).join('');

      const rowsHtml = overallRows.map((r) => `
        <tr>
          <td class="center font-bold font-mono" style="background:#ecfdf5;color:#047857;">${r.rank}</td>
          <td class="center font-mono">${r.nis}</td>
          <td class="center"><strong>${r.studentName}</strong></td>
          ${overallSubjects.map((s) => `<td class="center font-mono">${r.subjectScores[s.id] || '-'}</td>`).join('')}
          <td class="center font-bold font-mono" style="background:#f8fafc;">${r.totalScore}</td>
          <td class="center font-bold font-mono" style="font-size:10pt;color:#047857;background:#ecfdf5;">${r.averageScore}</td>
        </tr>
      `).join('');

      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">Rank</th>
              <th style="width: 60px;">NIS</th>
              <th>Nama Lengkap Siswa</th>
              ${headerCols}
              <th style="width: 50px;">Total</th>
              <th style="width: 50px;background:#047857;color:white;">Rerata</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    const teacherDisplayName = resolvedTeacher
      ? `${resolvedTeacher.title_prefix || ''} ${resolvedTeacher.full_name} ${resolvedTeacher.title_suffix || ''}`.trim()
      : user?.profile?.full_name || 'Guru Pengampu';

    printDocumentDirectly(contentHtml, {
      title: docTitle,
      subtitle: docSubtitle,
      schoolName: settings?.school_name,
      schoolAddress: settings?.address,
      logoUrl: settings?.logo_url || undefined,
      metadata: [
        { label: 'Tahun Ajaran', value: `${activeYearName} (Semester ${activeSemesterType})` },
        { label: 'Rombongan Belajar', value: currentClass.name },
        { label: 'KKTP Satuan Pendidikan', value: kktpDefault.toFixed(2) },
        { label: 'Status Dokumen', value: isLocked ? 'Terkunci & Disahkan' : 'Draft Penilaian' },
      ],
      signature: {
        leftTitle: isHomeroomRole ? 'Wali Kelas,' : 'Guru Pengampu,',
        leftName: teacherDisplayName,
        leftNip: resolvedTeacher?.nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: settings?.principal_name || 'Kepala Madrasah',
        rightNip: settings?.principal_nip || '-',
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Leger Nilai & Pengolahan Nilai Rapor
            </h1>
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <Lock className="w-3 h-3 text-rose-700" />
                <span>Rapor Dikunci</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi nilai sumatif dari beberapa TP / Lingkup Materi, STS, dan SAS yang menjadi dasar penentuan Nilai Akhir (NA) dan deskripsi capaian rapor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol AI Analisis */}
          {onNavigate && (
            <button
              onClick={() => onNavigate('asisten-ai-analisis')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-emerald-950 text-xs font-bold rounded-lg shadow-xs transition-colors"
              title="Gunakan AI untuk merumuskan narasi capaian rapor santri"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>AI Narasi Rapor</span>
            </button>
          )}

          {/* Tombol Cetak PDF Siap Cetak */}
          <button
            onClick={handlePrintLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-amber-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Cetak Berkas Leger Siap Cetak Lengkap Kop Madrasah"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF Siap Cetak</span>
          </button>

          {/* Tombol Ekspor CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Unduh format spreadsheet CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Ekspor CSV</span>
          </button>

          {/* Tombol Kunci Rapor (Admin / Kamad) */}
          {(activeRole === 'admin' || activeRole === 'kepala_madrasah') && (
            <button
              onClick={handleToggleLock}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs border transition-colors ${
                isLocked
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              {isLocked ? <Unlock className="w-3.5 h-3.5 text-rose-600" /> : <Lock className="w-3.5 h-3.5 text-emerald-700" />}
              <span>{isLocked ? 'Buka Kunci Rapor' : 'Kunci Rapor'}</span>
            </button>
          )}

          {/* Tarik Nilai dari Daftar Nilai & Simpan Perubahan */}
          {viewMode === 'per-mapel' && !isLocked && (
            <>
              <button
                onClick={handlePullFromGrades}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                title="Sinkronkan ulang kolom LM/STS/SAS dari Daftar Nilai Siswa & hasil Remedial"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Tarik dari Daftar Nilai</span>
              </button>
              <button
                onClick={handleRegenerateAllDescriptions}
                disabled={isSaving || subjectScores.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-950 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                title="Susun ulang seluruh Rumusan Capaian Kompetensi berdasarkan nilai LM, STS, SAS, dan KKTP saat ini"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Sinkronkan Rumusan</span>
              </button>
              <button
                onClick={handleSaveLedger}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 text-xs font-bold rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Nilai Leger'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Peringatan jika Guru / Wali Kelas belum memiliki penugasan */}
      {isTeacherRole && classes.length === 0 && (
        <div className="flex items-start gap-2.5 p-3.5 text-xs text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Belum Ada Penugasan Mengajar</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Admin belum menetapkan jadwal/penugasan mata pelajaran untuk akun Anda di menu Penugasan Mengajar.
            </p>
          </div>
        </div>
      )}

      {isHomeroomRole && classes.length === 0 && (
        <div className="flex items-start gap-2.5 p-3.5 text-xs text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Belum Ada Rombel Binaan Wali Kelas</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Admin belum menugaskan rombongan belajar binaan untuk akun Wali Kelas Anda di menu Penugasan Wali Kelas.
            </p>
          </div>
        </div>
      )}

      {/* Filter Rombel & Mode Tampilan */}
      <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pilih Rombel */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Rombel:</span>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={classes.length === 0}
              className="text-xs px-3 py-1.5 bg-white border border-emerald-200 rounded-lg focus:outline-emerald-600 font-bold text-slate-900 disabled:bg-slate-50"
            >
              {classes.length === 0 ? (
                <option value="">Tidak ada rombel</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Fase {c.phase})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Tab Tampilan Leger */}
          <div className="flex items-center bg-emerald-50/70 p-1 rounded-lg border border-emerald-200 text-xs">
            <button
              onClick={() => setViewMode('per-mapel')}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                viewMode === 'per-mapel'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 shadow-2xs font-bold'
                  : 'text-emerald-900/75 hover:text-emerald-950'
              }`}
            >
              Leger Per Mata Pelajaran
            </button>
            {canViewOverallClass && (
              <button
                onClick={() => setViewMode('rekap-kelas')}
                className={`px-3 py-1 rounded font-semibold transition-all ${
                  viewMode === 'rekap-kelas'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 shadow-2xs font-bold'
                    : 'text-emerald-900/75 hover:text-emerald-950'
                }`}
              >
                Leger Rekap Rombel Kelas
              </button>
            )}
          </div>

          {/* Pilihan Mata Pelajaran (hanya aktif jika mode per-mapel) */}
          {viewMode === 'per-mapel' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Mata Pelajaran:</span>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                disabled={availableSubjectsForClass.length === 0}
                className="text-xs px-3 py-1.5 bg-white border border-emerald-200 rounded-lg focus:outline-emerald-600 font-semibold text-slate-900 disabled:bg-slate-50"
              >
                {availableSubjectsForClass.length === 0 ? (
                  <option value="">Tidak ada mapel</option>
                ) : (
                  availableSubjectsForClass.map((sbj) => (
                    <option key={sbj.id} value={sbj.id}>
                      {sbj.name} ({sbj.category})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        {/* Ringkasan KKTP */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Kriteria Ketuntasan (KKTP):</span>
          <span className="font-mono tabular-nums font-bold text-emerald-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
            {kktpDefault.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Konten Leger */}
      {viewMode === 'per-mapel' ? (
        /* ================= TAMPILAN 1: LEGER PER MAPEL ================= */
        <div className="bg-white rounded-xl border border-emerald-200/80 overflow-hidden shadow-xs">
          <div className="p-3.5 bg-emerald-50/60 border-b border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-emerald-950">
                {currentSubject.name} — {currentClass.name}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">
                Rumus NA Rapor = <strong>(2 × Rerata LM + STS + SAS) ÷ 4</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {isLocked ? (
                <span className="text-rose-700 font-bold">Mode Terkunci (Hanya Baca)</span>
              ) : (
                <span>Ketik langsung nilai pada kolom untuk memperbarui nilai secara otomatis</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-emerald-200 bg-emerald-50/80 text-emerald-950 font-semibold text-[11px]">
                  <th rowSpan={2} className="py-2.5 px-3 text-center align-middle w-10">No</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center align-middle w-20">NIS</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center align-middle min-w-[170px]">Nama Lengkap Siswa</th>
                  <th colSpan={4} className="py-1.5 px-2 text-center align-middle bg-amber-50 text-emerald-950 border-l border-r border-amber-200">
                    Sumatif Lingkup Materi / TP
                  </th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center align-middle w-16 bg-emerald-100/70 text-emerald-950">Rerata LM</th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center align-middle w-16">STS</th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center align-middle w-16">SAS</th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center align-middle w-16 bg-emerald-900 text-amber-300 font-bold">
                    NA Rapor
                  </th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center align-middle w-12">Pred</th>
                  <th rowSpan={2} className="py-2.5 px-3 align-middle min-w-[260px]">Rumusan Capaian Kompetensi (Rapor)</th>
                </tr>
                <tr className="border-b border-emerald-200 bg-amber-50/60 text-emerald-950 font-medium text-[10px]">
                  <th className="py-1 px-1.5 text-center w-14 border-l border-amber-200">LM 1</th>
                  <th className="py-1 px-1.5 text-center w-14">LM 2</th>
                  <th className="py-1 px-1.5 text-center w-14">LM 3</th>
                  <th className="py-1 px-1.5 text-center w-14 border-r border-amber-200">LM 4</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-400">
                      Memuat leger nilai...
                    </td>
                  </tr>
                ) : subjectScores.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-400">
                      Belum ada data nilai untuk rombel ini.
                    </td>
                  </tr>
                ) : (
                  subjectScores.map((row, idx) => (
                    <tr key={row.studentId} className="hover:bg-emerald-50/35 transition-colors">
                      <td className="py-2 px-3 text-center align-middle font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 text-center align-middle font-mono text-slate-600">{row.nis}</td>
                      <td className="py-2 px-3 text-center align-middle">
                        <span className="font-bold text-slate-900">{row.studentName}</span>
                      </td>

                      {/* Input Nilai LM1 */}
                      <td className="py-1.5 px-1 text-center border-l border-emerald-100">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={row.lmScores.lm1}
                          onChange={(e) =>
                            handleScoreChange(row.studentId, 'lm1', Number(e.target.value))
                          }
                          className="w-12 text-center font-mono py-1 border border-emerald-200 rounded focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-50"
                        />
                      </td>

                      {/* Input Nilai LM2 */}
                      <td className="py-1.5 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={row.lmScores.lm2}
                          onChange={(e) =>
                            handleScoreChange(row.studentId, 'lm2', Number(e.target.value))
                          }
                          className="w-12 text-center font-mono py-1 border border-emerald-200 rounded focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-50"
                        />
                      </td>

                      {/* Input Nilai LM3 */}
                      <td className="py-1.5 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={row.lmScores.lm3}
                          onChange={(e) =>
                            handleScoreChange(row.studentId, 'lm3', Number(e.target.value))
                          }
                          className="w-12 text-center font-mono py-1 border border-emerald-200 rounded focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-50"
                        />
                      </td>

                      {/* Input Nilai LM4 */}
                      <td className="py-1.5 px-1 text-center border-r border-emerald-100">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={row.lmScores.lm4}
                          onChange={(e) =>
                            handleScoreChange(row.studentId, 'lm4', Number(e.target.value))
                          }
                          className="w-12 text-center font-mono py-1 border border-emerald-200 rounded focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-50"
                        />
                      </td>

                      {/* Rerata LM */}
                      <td className="py-2 px-2 text-center font-mono font-bold bg-emerald-50/50 text-emerald-950">
                        {row.avgLm}
                      </td>

                      {/* Input Nilai STS */}
                      <td className="py-1.5 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={row.stsScore}
                          onChange={(e) =>
                            handleScoreChange(row.studentId, 'stsScore', Number(e.target.value))
                          }
                          className="w-12 text-center font-mono py-1 border border-emerald-200 rounded focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-50"
                        />
                      </td>

                      {/* Input Nilai SAS */}
                      <td className="py-1.5 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={row.sasScore}
                          onChange={(e) =>
                            handleScoreChange(row.studentId, 'sasScore', Number(e.target.value))
                          }
                          className="w-12 text-center font-mono py-1 border border-emerald-200 rounded focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-50"
                        />
                      </td>

                      {/* Nilai Akhir (NA) */}
                      <td className="py-2 px-2 text-center font-mono font-extrabold text-sm bg-amber-50 text-emerald-950 border-l border-r border-amber-200/80">
                        {row.finalScore}
                      </td>

                      {/* Predikat */}
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.predicate === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.predicate === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : row.predicate === 'C'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.predicate}
                        </span>
                      </td>

                      {/* Capaian Kompetensi Rapor */}
                      <td className="py-2 px-3 text-[11px] leading-relaxed">
                        {editingDescStudentId === row.studentId && !isLocked ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-700 mb-0.5">
                                Tercapai:
                              </label>
                              <textarea
                                rows={2}
                                value={row.highestCompetency}
                                onChange={(e) =>
                                  handleCustomDescChange(row.studentId, 'highestCompetency', e.target.value)
                                }
                                className="w-full text-[11px] p-1.5 border border-emerald-300 rounded focus:outline-emerald-600"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-amber-700 mb-0.5">
                                Perlu Peningkatan:
                              </label>
                              <textarea
                                rows={2}
                                value={row.lowestCompetency}
                                onChange={(e) =>
                                  handleCustomDescChange(row.studentId, 'lowestCompetency', e.target.value)
                                }
                                className="w-full text-[11px] p-1.5 border border-amber-300 rounded focus:outline-amber-600"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleResetStudentDesc(row.studentId)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Otomatis</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDescStudentId(null)}
                                className="px-2 py-0.5 text-[10px] font-bold text-emerald-950 bg-amber-400 hover:bg-amber-500 rounded"
                              >
                                Selesai
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-emerald-900 font-medium">
                              <strong className="text-emerald-700">Tercapai:</strong> {row.highestCompetency}
                            </p>
                            <p className="text-amber-900 font-medium">
                              <strong className="text-amber-700">Perlu Peningkatan:</strong>{' '}
                              {row.lowestCompetency}
                            </p>
                            {!isLocked && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingDescStudentId(row.studentId)}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-emerald-800"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{row.isDescriptionCustom ? 'Ubah (Kustom)' : 'Sesuaikan Teks'}</span>
                                </button>
                                {row.isDescriptionCustom && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetStudentDesc(row.studentId)}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reset Otomatis</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= TAMPILAN 2: LEGER REKAP KELAS ================= */
        <div className="bg-white rounded-xl border border-emerald-200/80 overflow-hidden shadow-xs">
          <div className="p-3.5 bg-emerald-50/60 border-b border-emerald-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-emerald-950">
                Matriks Leger Nilai Seluruh Mapel — {currentClass.name}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Peringkat dihitung dari akumulasi total nilai akhir seluruh mata pelajaran kurikulum madrasah
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-emerald-200 bg-emerald-50/80 text-emerald-950 font-semibold text-[11px]">
                  <th className="py-2.5 px-3 text-center align-middle w-12 bg-amber-50 text-emerald-950">Rank</th>
                  <th className="py-2.5 px-3 text-center align-middle w-20">NIS</th>
                  <th className="py-2.5 px-3 text-center align-middle min-w-[170px]">Nama Lengkap Siswa</th>
                  {overallSubjects.map((s) => (
                    <th key={s.id} className="py-2.5 px-2 text-center align-middle w-12" title={s.name}>
                      {s.code}
                    </th>
                  ))}
                  <th className="py-2.5 px-2 text-center align-middle w-16 bg-emerald-100/80 text-emerald-950 font-bold">Total</th>
                  <th className="py-2.5 px-2 text-center align-middle w-16 bg-emerald-900 text-amber-300 font-bold">
                    Rerata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={overallSubjects.length + 5} className="py-10 text-center text-slate-400">
                      Menghitung rekapitulasi leger kelas...
                    </td>
                  </tr>
                ) : overallRows.length === 0 ? (
                  <tr>
                    <td colSpan={overallSubjects.length + 5} className="py-10 text-center text-slate-400">
                      Belum ada data nilai rombel.
                    </td>
                  </tr>
                ) : (
                  overallRows.map((row) => (
                    <tr key={row.studentId} className="hover:bg-emerald-50/35 transition-colors">
                      <td className="py-2 px-3 text-center align-middle font-mono font-bold bg-amber-50/70 text-emerald-950">
                        {row.rank}
                      </td>
                      <td className="py-2 px-3 text-center align-middle font-mono text-slate-600">{row.nis}</td>
                      <td className="py-2 px-3 text-center align-middle font-bold text-slate-900">{row.studentName}</td>
                      {overallSubjects.map((s) => {
                        const sc = row.subjectScores[s.id] || 0;
                        return (
                          <td
                            key={s.id}
                            className={`py-2 px-2 text-center font-mono tabular-nums ${
                              sc < kktpDefault ? 'text-rose-700 font-bold bg-rose-50/50' : 'text-slate-800'
                            }`}
                          >
                            {sc || '-'}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center font-mono font-bold bg-emerald-50/50 text-emerald-950">
                        {row.totalScore}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-extrabold text-sm bg-amber-50 text-emerald-950">
                        {row.averageScore}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
