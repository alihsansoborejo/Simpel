import React, { useState, useEffect, useCallback } from 'react';
import { journalService } from '../../services/journalService';
import { academicService } from '../../services/academicService';
import {
  TeachingJournal,
  TeachingAssignment,
  SystemSettings,
  Teacher,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Plus,
  CheckCircle,
  Heart,
  Sparkles,
  Search,
  BookOpen,
  Download,
  Printer,
  Table as TableIcon,
  LayoutList,
  AlertCircle,
  Edit3,
  Trash2,
} from 'lucide-react';

interface TeachingJournalPageProps {
  onNavigate?: (view: string) => void;
}

export const TeachingJournalPage: React.FC<TeachingJournalPageProps> = ({ onNavigate }) => {
  const { user, activeRole } = useAuth();
  const { selectedAssignmentId, selectedSubjectId, selectedClassId, setWorkspaceSelection } =
    useWorkspace();
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeYearName, setActiveYearName] = useState<string>('2026/2027');
  const [activeSemesterType, setActiveSemesterType] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingJournal, setEditingJournal] = useState<TeachingJournal | null>(null);
  const [pendingDeleteJournal, setPendingDeleteJournal] = useState<TeachingJournal | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState<string>('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const lastAppliedWorkspaceKeyRef = React.useRef<string>('');

  // Form State
  const [assignmentId, setAssignmentId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodHours, setPeriodHours] = useState<string>('Jam ke-1 s.d. 3 (07.00 - 09.00 WIB)');
  const [topic, setTopic] = useState<string>('');
  const [objective, setObjective] = useState<string>('');
  const [activities, setActivities] = useState<string>('');
  const [method, setMethod] = useState<string>('Pembelajaran Mendalam (Deep Learning) & Kolaboratif');
  const [reflection, setReflection] = useState<string>('');
  const [obstacles, setObstacles] = useState<string>('');
  const [followUp, setFollowUp] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jrns, asgs, teacher, sys, years, sems, tchs] = await Promise.all([
        journalService.getJournals(),
        academicService.getTeachingAssignments(),
        academicService.resolveTeacherForUser(user),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.getTeachers(),
      ]);

      setResolvedTeacher(teacher);
      setTeachersList(tchs);
      setSettings(sys);

      const actYear = years.find((y) => y.id === sys.active_academic_year_id || y.is_active) || years[0];
      const actSem = sems.find((s) => s.id === sys.active_semester_id || s.is_active) || sems[0];
      if (actYear?.name) setActiveYearName(actYear.name);
      if (actSem?.semester_type) setActiveSemesterType(actSem.semester_type);

      const scopedAsgs =
        activeRole === 'guru'
          ? academicService.filterAssignmentsForUser(asgs, user, teacher, tchs)
          : asgs;
      const scopedIds = new Set(scopedAsgs.map((a) => a.id));
      const { candidateTeacherIds, matchesTeacherRecord } = academicService.getMatchingTeacherIdsForUser(
        user,
        teacher,
        tchs
      );
      const scopedJournals =
        activeRole === 'guru'
          ? jrns.filter(
              (j) =>
                scopedIds.has(j.assignment_id) ||
                (j.assignment?.teacher_id ? candidateTeacherIds.has(j.assignment.teacher_id) : false) ||
                (j.assignment?.teacher ? matchesTeacherRecord(j.assignment.teacher) : false)
            )
          : jrns;

      setAssignments(scopedAsgs);
      setJournals(scopedJournals);

      if (scopedAsgs.length > 0) {
        const wsKey = `${selectedAssignmentId || ''}|${selectedSubjectId || ''}|${selectedClassId || ''}`;
        const wsAsg =
          (selectedAssignmentId && scopedAsgs.find((a) => a.id === selectedAssignmentId)) ||
          scopedAsgs.find(
            (a) =>
              (!selectedSubjectId || a.subject_id === selectedSubjectId) &&
              (!selectedClassId || a.class_id === selectedClassId)
          );

        if (wsKey !== lastAppliedWorkspaceKeyRef.current) {
          lastAppliedWorkspaceKeyRef.current = wsKey;
          if (wsAsg && (selectedAssignmentId || (selectedSubjectId && selectedClassId))) {
            setSelectedAssignmentFilter(wsAsg.id);
            setAssignmentId(wsAsg.id);
          } else {
            setAssignmentId((prev) =>
              prev && scopedAsgs.some((a) => a.id === prev) ? prev : scopedAsgs[0].id
            );
          }
        } else {
          setAssignmentId((prev) =>
            prev && scopedAsgs.some((a) => a.id === prev)
              ? prev
              : wsAsg?.id || scopedAsgs[0].id
          );
        }
      } else {
        setAssignmentId('');
      }
    } catch (err) {
      console.error('Gagal memuat jurnal mengajar:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, user?.id, user?.email, user?.teacherId, user?.profile?.full_name, selectedAssignmentId, selectedSubjectId, selectedClassId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeSync(
    [
      'simpel_teaching_journals',
      'simpel_assignments',
      'simpel_teachers',
      'simpel_users_cache_v2',
      'simpel_classes',
      'simpel_subjects',
      'simpel_academic_years',
      'simpel_semesters',
      'simpel_settings',
    ],
    () => {
      void loadData();
    }
  );

  const handleOpenEditJournal = (j: TeachingJournal) => {
    setFormError(null);
    setEditingJournal(j);
    setAssignmentId(j.assignment_id);
    setDate(j.date);
    setPeriodHours(j.period_hours || 'Jam ke-1 s.d. 3');
    setTopic(j.topic);
    setObjective(j.learning_objective);
    setActivities(j.learning_activities);
    setMethod(j.learning_method || 'Pembelajaran Mendalam (Deep Learning)');
    setReflection(j.reflection || '');
    setObstacles(j.obstacles || '');
    setFollowUp(j.follow_up || '');
    setNotes(j.notes || '');
    setShowModal(true);
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const effectiveAssignmentId = assignmentId || assignments[0]?.id || '';
    if (!effectiveAssignmentId) {
      setFormError('Pilih Mata Pelajaran & Kelas yang diampu terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingJournal) {
        const updated = await journalService.updateJournal(editingJournal.id, {
          assignment_id: effectiveAssignmentId,
          date,
          period_hours: periodHours.trim() || 'Jam ke-1 s.d. 2',
          topic: topic.trim(),
          learning_objective: objective.trim(),
          learning_activities: activities.trim(),
          learning_method: method.trim() || 'Pembelajaran Mendalam',
          reflection: reflection.trim() || null,
          obstacles: obstacles.trim() || null,
          follow_up: followUp.trim() || null,
          notes: notes.trim() || null,
        });
        setJournals((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        setStatusMessage('Perubahan jurnal mengajar berhasil disimpan & disinkronkan.');
      } else {
        const created = await journalService.createJournal({
          assignment_id: effectiveAssignmentId,
          date,
          period_hours: periodHours.trim() || 'Jam ke-1 s.d. 2',
          topic: topic.trim(),
          learning_objective: objective.trim(),
          learning_activities: activities.trim(),
          learning_method: method.trim() || 'Pembelajaran Mendalam',
          reflection: reflection.trim() || null,
          obstacles: obstacles.trim() || null,
          follow_up: followUp.trim() || null,
          notes: notes.trim() || null,
        });

        setJournals((prev) => [created, ...prev.filter((j) => j.id !== created.id)]);
        if (selectedAssignmentFilter !== 'all' && selectedAssignmentFilter !== created.assignment_id) {
          setSelectedAssignmentFilter(created.assignment_id);
        }
        if (searchTerm.trim()) {
          setSearchTerm('');
        }
        setStatusMessage('Jurnal mengajar harian berhasil disimpan dan langsung disinkronkan.');
      }
      setShowModal(false);
      setEditingJournal(null);
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Gagal menyimpan jurnal:', err);
      setFormError(err?.message || 'Gagal menyimpan jurnal mengajar. Silakan periksa kembali isian Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteJournal = async () => {
    if (!pendingDeleteJournal) return;
    try {
      await journalService.deleteJournal(pendingDeleteJournal.id);
      setPendingDeleteJournal(null);
      setStatusMessage('Jurnal mengajar berhasil dihapus.');
      await loadData();
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menghapus jurnal:', err);
    }
  };

  const filteredJournals = journals.filter((j) => {
    const matchesAssignment =
      selectedAssignmentFilter === 'all' || j.assignment_id === selectedAssignmentFilter;
    const matchesTeacher =
      activeRole === 'guru' ||
      selectedTeacherFilter === 'all' ||
      j.assignment?.teacher_id === selectedTeacherFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (j.topic || '').toLowerCase().includes(q) ||
      (j.learning_objective || '').toLowerCase().includes(q) ||
      (j.learning_activities || '').toLowerCase().includes(q) ||
      (j.assignment?.teacher?.full_name || '').toLowerCase().includes(q) ||
      (j.date || '').includes(searchTerm);
    return matchesAssignment && matchesTeacher && matchesSearch;
  });

  // Ekspor ke format CSV / Excel
  const exportToCSV = () => {
    const headers = [
      'No',
      'Tanggal KBM',
      'Guru Pengampu',
      'Kelas',
      'Mata Pelajaran',
      'Jam Pelajaran',
      'Materi / Topik',
      'Tujuan Pembelajaran (TP)',
      'Aktivitas KBM & Metode',
      'Refleksi Kurikulum Berbasis Cinta',
      'Kendala Belajar',
      'Rencana Tindak Lanjut',
    ];

    const rows = filteredJournals.map((j, idx) => [
      idx + 1,
      j.date,
      `"${j.assignment?.teacher?.full_name || 'Guru Pengampu'}"`,
      `"${j.assignment?.class?.name || '-'}"`,
      `"${j.assignment?.subject?.name || 'Mata Pelajaran'}"`,
      `"${j.period_hours}"`,
      `"${j.topic.replace(/"/g, '""')}"`,
      `"${j.learning_objective.replace(/"/g, '""')}"`,
      `"${(j.learning_activities + ' | ' + j.learning_method).replace(/"/g, '""')}"`,
      `"${(j.reflection || '').replace(/"/g, '""')}"`,
      `"${(j.obstacles || '-').replace(/"/g, '""')}"`,
      `"${(j.follow_up || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `jurnal_mengajar_mi_al_ihsan_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const tableRows = filteredJournals.map((j, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="center font-mono">${j.date}</td>
        <td><strong>${j.assignment?.subject?.name || 'Mata Pelajaran'}</strong><br><small>${j.assignment?.class?.name || '-'}${j.assignment?.teacher?.full_name ? ` · ${j.assignment.teacher.full_name}` : ''}</small></td>
        <td>${j.topic}</td>
        <td>${j.learning_activities}</td>
        <td><span style="color:#047857;font-weight:bold;">${j.learning_method || '-'}</span></td>
        <td>Jam: ${j.period_hours || '-'}<br><small>Hambatan: ${j.obstacles || 'Nihil'}</small></td>
      </tr>
    `).join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">No</th>
            <th style="width: 80px;">Tanggal KBM</th>
            <th style="width: 140px;">Mata Pelajaran & Kelas</th>
            <th>Materi Pokok Pembelajaran</th>
            <th>Aktivitas KBM (Deep Learning)</th>
            <th style="width: 130px;">Nilai KBC</th>
            <th style="width: 140px;">Presensi & Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printDocumentDirectly(contentHtml, {
      title: 'BUKU JURNAL MENGAJAR HARIAN GURU',
      subtitle: `Tahun Ajaran ${activeYearName} - Berbasis Kurikulum Cinta (KBC) & Pembelajaran Mendalam`,
      metadata: [
        { label: 'Tahun Pelajaran', value: `${activeYearName} (Semester ${activeSemesterType})` },
        { label: 'Total Pertemuan', value: `${filteredJournals.length} Catatan Jurnal KBM` },
        { label: 'Pendekatan', value: 'Kurikulum Berbasis Cinta (KBC)' },
        { label: 'Tanggal Cetak', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: 'Guru Pengampu Mata Pelajaran,',
        leftName: user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Pengampu',
        leftNip: resolvedTeacher?.nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
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
            Jurnal Mengajar Harian Guru (Tabel & Rekap)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan langsung KBM dengan metode Pembelajaran Mendalam dan Kurikulum Berbasis Cinta, siap diekspor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('asisten-ai-refleksi')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Konsultasi kendala kelas dan solusi dengan Asisten AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-950" />
              <span>Analisis Refleksi AI</span>
            </button>
          )}

          {/* Tombol Ekspor CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Unduh format spreadsheet CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel / CSV</span>
          </button>

          {/* Tombol Cetak / PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Cetak atau simpan sebagai dokumen PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>

          {/* Tombol Entri Baru */}
          <button
            onClick={() => {
              setFormError(null);
              setEditingJournal(null);
              if (selectedAssignmentFilter !== 'all') {
                setAssignmentId(selectedAssignmentFilter);
              } else if (!assignmentId && assignments[0]?.id) {
                setAssignmentId(assignments[0].id);
              }
              setTopic('');
              setObjective('');
              setActivities('');
              setReflection('');
              setObstacles('');
              setFollowUp('');
              setNotes('');
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Isi Jurnal Baru</span>
          </button>
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
          REKAPITULASI JURNAL MENGAJAR HARIAN GURU
        </h2>
        <h3 className="text-sm font-semibold text-slate-800">
          {settings?.school_name || "MI MA'ARIF AL IHSAN SOBOREJO"} · TAHUN PELAJARAN {activeYearName}
        </h3>
        <p className="text-xs text-slate-600 mt-0.5">
          Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah · Dicetak pada: {new Date().toLocaleDateString('id-ID')}
        </p>
      </div>

      {activeRole === 'guru' && assignments.length === 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Anda belum memiliki penugasan mengajar dari Admin Madrasah. Jurnal baru dapat diisi setelah jadwal mapel Anda ditetapkan di menu <strong>Penugasan Mengajar</strong>.
          </span>
        </div>
      )}

      {/* Toolbar Filter & Mode Tampilan */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Mapel/Rombel */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Mapel / Rombel:</span>
            <select
              value={selectedAssignmentFilter}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedAssignmentFilter(nextId);
                if (nextId !== 'all') {
                  setAssignmentId(nextId);
                  const found = assignments.find((a) => a.id === nextId);
                  if (found) {
                    setWorkspaceSelection({
                      assignmentId: found.id,
                      subjectId: found.subject_id,
                      classId: found.class_id,
                      classLevel: found.class?.level || null,
                    });
                  }
                }
              }}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
            >
              <option value="all">Semua Mata Pelajaran Diampu</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.class?.name || '-'} - {a.subject?.name || 'Mapel'}
                  {activeRole !== 'guru' && a.teacher?.full_name ? ` (${a.teacher.full_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {activeRole !== 'guru' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Guru:</span>
              <select
                value={selectedTeacherFilter}
                onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
              >
                <option value="all">Semua Dewan Guru</option>
                {teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Mode Tampilan */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel / List</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Kartu Rinci</span>
            </button>
          </div>
        </div>

        {/* Pencarian */}
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari materi, TP, atau tanggal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>
      </div>

      {/* Tampilan 1: Tabel / List Terstruktur (Exportable) */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-3.5 w-10 text-center font-mono">No</th>
                  <th className="py-3 px-3.5 w-24">Tanggal</th>
                  <th className="py-3 px-3.5 w-36">Kelas & Mapel</th>
                  <th className="py-3 px-3.5 w-48">Materi Pokok / Topik</th>
                  <th className="py-3 px-3.5">Tujuan & Aktivitas KBM</th>
                  <th className="py-3 px-3.5 w-44">Refleksi Berbasis Cinta</th>
                  <th className="py-3 px-3.5 w-36">Tindak Lanjut</th>
                  <th className="py-3 px-3.5 w-20 text-right print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Memuat jurnal mengajar...
                    </td>
                  </tr>
                ) : filteredJournals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada data jurnal mengajar yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredJournals.map((j, idx) => (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="py-3 px-3.5 text-center font-mono tabular-nums text-slate-400 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono tabular-nums text-slate-800">
                        <div className="font-bold">{j.date}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{j.period_hours}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{j.assignment?.subject?.name || 'Mata Pelajaran'}</div>
                        <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                          {j.assignment?.class?.name || '-'}
                        </div>
                        {j.assignment?.teacher?.full_name && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Guru: {j.assignment.teacher.full_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900 leading-snug">
                        {j.topic}
                      </td>
                      <td className="py-3 px-3.5 space-y-1">
                        <p className="text-slate-800 leading-relaxed font-medium">
                          {j.learning_objective}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {j.learning_activities}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                          <Sparkles className="w-3 h-3" />
                          <span>{j.learning_method}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="p-2 rounded bg-emerald-50/60 border border-emerald-100/80 text-[11px] text-slate-700 italic leading-relaxed">
                          "{j.reflection || 'Pembelajaran berlangsung kondusif dan hangat.'}"
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-[11px]">
                        <div className="font-semibold text-slate-800">{j.follow_up || '-'}</div>
                        {j.obstacles && (
                          <div className="text-slate-500 mt-1">
                            <span className="font-medium text-amber-800">Kendala: </span>
                            {j.obstacles}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right print:hidden">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditJournal(j)}
                            className="p-1 text-slate-400 hover:text-emerald-700 cursor-pointer"
                            title="Edit Jurnal"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteJournal(j)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Hapus Jurnal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tampilan 2: Kartu Rinci */
        <div className="space-y-4">
          {filteredJournals.map((j) => (
            <div
              key={j.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-200 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{j.topic}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-emerald-800">
                        {j.assignment?.subject?.name || 'Mata Pelajaran'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{j.assignment?.class?.name || '-'}</span>
                      {j.assignment?.teacher?.full_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">{j.assignment.teacher.full_name}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{j.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] font-mono tabular-nums text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 font-medium">
                    {j.period_hours}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditJournal(j)}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 print:hidden cursor-pointer"
                    title="Edit Jurnal"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteJournal(j)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 print:hidden cursor-pointer"
                    title="Hapus Jurnal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">Tujuan Pembelajaran:</span>
                    <p className="text-slate-600 leading-relaxed">{j.learning_objective}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">Aktivitas KBM & Metode:</span>
                    <p className="text-slate-600 leading-relaxed">{j.learning_activities}</p>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{j.learning_method}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-lg border border-slate-100">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-800 font-semibold mb-0.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      <span>Refleksi Kurikulum Berbasis Cinta:</span>
                    </div>
                    <p className="text-slate-600 italic leading-relaxed">
                      "{j.reflection || 'Pembelajaran berjalan hangat, siswa saling menghargai pendapat.'}"
                    </p>
                  </div>
                  {j.obstacles && (
                    <div>
                      <span className="font-semibold text-slate-700 block mb-0.5">Kendala:</span>
                      <p className="text-slate-600">{j.obstacles}</p>
                    </div>
                  )}
                  {j.follow_up && (
                    <div>
                      <span className="font-semibold text-slate-700 block mb-0.5">Rencana Tindak Lanjut:</span>
                      <p className="text-slate-600">{j.follow_up}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
          <p>Soborejo, {new Date().toLocaleDateString('id-ID')}</p>
          <p className="font-bold">Guru Pengampu</p>
          <div className="h-16" />
          <p className="font-bold underline">{user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Pengampu'}</p>
          <p className="font-mono">NIP. {resolvedTeacher?.nip || '-'}</p>
        </div>
      </div>

      {/* Modal Entri / Edit Jurnal Mengajar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingJournal ? 'Edit Jurnal Mengajar Harian' : 'Entri Jurnal Mengajar Harian'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Isi data pelaksanaan pembelajaran langsung di aplikasi SIMPEL MI Al Ihsan.
            </p>

            {formError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveJournal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran & Kelas</label>
                  <select
                    value={assignmentId}
                    onChange={(e) => setAssignmentId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                    required
                  >
                    {assignments.length === 0 ? (
                      <option value="">Belum ada penugasan mengajar</option>
                    ) : (
                      assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.class?.name || '-'} - {a.subject?.name || 'Mapel'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal KBM</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Pelajaran</label>
                  <input
                    type="text"
                    value={periodHours}
                    onChange={(e) => setPeriodHours(e.target.value)}
                    placeholder="Contoh: Jam ke-1 s.d. 3 (07.00 - 09.00 WIB)"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model / Metode Pembelajaran</label>
                  <input
                    type="text"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    placeholder="Contoh: Pembelajaran Mendalam (Deep Learning)"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Materi Pokok / Topik Bahasan</label>
                <input
                  type="text"
                  placeholder="Contoh: Membaca Terbimbing Teks Narasi Kasih Sayang"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tujuan Pembelajaran (TP)</label>
                <textarea
                  rows={2}
                  placeholder="Tuliskan tujuan pembelajaran yang dicapai pada sesi KBM ini..."
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rincian Aktivitas KBM</label>
                <textarea
                  rows={3}
                  placeholder="1. Pendahuluan & salam cinta madrasah. 2. Kegiatan inti membaca & eksplorasi. 3. Refleksi & doa penutup..."
                  value={activities}
                  onChange={(e) => setActivities(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refleksi Pembelajaran (Kurikulum Berbasis Cinta)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan kehangatan suasana kelas, respon antusias santri, dan nilai kasih sayang..."
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kendala / Hambatan</label>
                  <textarea
                    rows={2}
                    placeholder="Kendala pemahaman siswa jika ada..."
                    value={obstacles}
                    onChange={(e) => setObstacles(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rencana Tindak Lanjut</label>
                  <textarea
                    rows={2}
                    placeholder="Tindak lanjut untuk pertemuan berikutnya..."
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingJournal(null);
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Menyimpan...'
                    : editingJournal
                    ? 'Simpan Perubahan'
                    : 'Simpan Jurnal Mengajar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Hapus Jurnal Mengajar?</h3>
            <p className="text-xs text-slate-600">
              Jurnal <strong>{pendingDeleteJournal.topic}</strong> ({pendingDeleteJournal.date}) akan dihapus dari daftar.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingDeleteJournal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteJournal()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
