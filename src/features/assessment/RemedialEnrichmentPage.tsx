import React, { useState, useEffect, useCallback } from 'react';
import { assessmentService } from '../../services/assessmentService';
import { academicService } from '../../services/academicService';
import {
  RemedialRecord,
  EnrichmentRecord,
  Student,
  TeachingAssignment,
  ClassMember,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Plus,
  CheckCircle,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export const RemedialEnrichmentPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const { selectedAssignmentId, selectedSubjectId, selectedClassId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'remedial' | 'enrichment'>('remedial');
  const [remedials, setRemedials] = useState<RemedialRecord[]>([]);
  const [enrichments, setEnrichments] = useState<EnrichmentRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal State
  const [showRemedialModal, setShowRemedialModal] = useState<boolean>(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState<boolean>(false);

  // Form Remedial
  const [remAssignmentId, setRemAssignmentId] = useState<string>('');
  const [remStudentId, setRemStudentId] = useState<string>('');
  const [remObjective, setRemObjective] = useState<string>('');
  const [remActivity, setRemActivity] = useState<string>('');
  const [remDate, setRemDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remScoreBefore, setRemScoreBefore] = useState<number>(65);
  const [remScoreAfter, setRemScoreAfter] = useState<number>(78);
  const [remFollowup, setRemFollowup] = useState<string>('Tuntas KKTP');

  // Form Pengayaan
  const [enrAssignmentId, setEnrAssignmentId] = useState<string>('');
  const [enrStudentId, setEnrStudentId] = useState<string>('');
  const [enrTopic, setEnrTopic] = useState<string>('');
  const [enrActivity, setEnrActivity] = useState<string>('');
  const [enrDate, setEnrDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [enrNotes, setEnrNotes] = useState<string>('');

  const getStudentsForAssignment = useCallback(
    (asgId: string, asgsPool: TeachingAssignment[], stdsPool: Student[], membersPool: ClassMember[]): Student[] => {
      const targetAsg = asgsPool.find((a) => a.id === asgId);
      if (!targetAsg) return stdsPool;
      const enrolledIds = membersPool
        .filter((m) => m.class_id === targetAsg.class_id)
        .map((m) => m.student_id);
      return stdsPool.filter((s) => enrolledIds.includes(s.id));
    },
    []
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rems, enrs, stds, asgs, members, teacher] = await Promise.all([
        assessmentService.getRemedialRecords(),
        assessmentService.getEnrichmentRecords(),
        academicService.getStudents(),
        academicService.getTeachingAssignments(),
        academicService.getClassMembers(),
        academicService.resolveTeacherForUser(user),
      ]);

      const scopedAsgs =
        activeRole === 'guru'
          ? teacher
            ? asgs.filter((a) => a.teacher_id === teacher.id)
            : []
          : asgs;
      const scopedIds = new Set(scopedAsgs.map((a) => a.id));

      setRemedials(activeRole === 'guru' ? rems.filter((r) => scopedIds.has(r.assignment_id)) : rems);
      setEnrichments(activeRole === 'guru' ? enrs.filter((e) => scopedIds.has(e.assignment_id)) : enrs);
      setStudents(stds);
      setClassMembers(members);
      setAssignments(scopedAsgs);

      const defaultAsg =
        (selectedAssignmentId && scopedAsgs.find((a) => a.id === selectedAssignmentId)) ||
        scopedAsgs.find(
          (a) =>
            (!selectedSubjectId || a.subject_id === selectedSubjectId) &&
            (!selectedClassId || a.class_id === selectedClassId)
        ) ||
        scopedAsgs[0];

      const preferredAsgId = defaultAsg?.id || '';
      setRemAssignmentId((prev) => (scopedAsgs.some((a) => a.id === prev) ? prev : preferredAsgId));
      setEnrAssignmentId((prev) => (scopedAsgs.some((a) => a.id === prev) ? prev : preferredAsgId));

      const filteredRemStudents = getStudentsForAssignment(preferredAsgId, scopedAsgs, stds, members);
      const firstStudent = filteredRemStudents[0] || stds[0];
      if (firstStudent) {
        setRemStudentId((prev) =>
          filteredRemStudents.some((s) => s.id === prev) ? prev : firstStudent.id
        );
        setEnrStudentId((prev) =>
          filteredRemStudents.some((s) => s.id === prev) ? prev : firstStudent.id
        );
      }
    } catch (err) {
      console.error('Gagal memuat data remedial & pengayaan:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeRole,
    user?.id,
    user?.teacherId,
    selectedAssignmentId,
    selectedSubjectId,
    selectedClassId,
    getStudentsForAssignment,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeSync(
    ['simpel_remedial', 'simpel_enrichment', 'simpel_students', 'simpel_assignments', 'simpel_class_members', 'simpel_teachers'],
    () => {
      void loadData();
    }
  );

  const handleCreateRemedial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remAssignmentId || !remStudentId) return;
    try {
      await assessmentService.createRemedialRecord({
        assignment_id: remAssignmentId,
        student_id: remStudentId,
        unachieved_objective: remObjective,
        remedial_activity: remActivity,
        execution_date: remDate,
        score_before: remScoreBefore,
        score_after: remScoreAfter,
        follow_up_action: remFollowup,
      });
      setShowRemedialModal(false);
      setStatusMessage('Catatan program remedial berhasil disimpan.');
      void loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal membuat remedial:', err);
    }
  };

  const handleCreateEnrichment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrAssignmentId || !enrStudentId) return;
    try {
      await assessmentService.createEnrichmentRecord({
        assignment_id: enrAssignmentId,
        student_id: enrStudentId,
        objective_topic: enrTopic,
        enrichment_activity: enrActivity,
        execution_date: enrDate,
        result_notes: enrNotes,
      });
      setShowEnrichmentModal(false);
      setStatusMessage('Catatan program pengayaan berhasil disimpan.');
      void loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal membuat pengayaan:', err);
    }
  };

  const remModalStudents = getStudentsForAssignment(remAssignmentId, assignments, students, classMembers);
  const enrModalStudents = getStudentsForAssignment(enrAssignmentId, assignments, students, classMembers);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Program Remedial & Pengayaan</h1>
          <p className="text-xs text-slate-500 mt-1">
            Intervensi perbaikan capaian pembelajaran untuk siswa belum tuntas serta penguatan materi bagi siswa unggul.
          </p>
        </div>
        <div>
          {activeTab === 'remedial' ? (
            <button
              onClick={() => {
                setRemObjective('');
                setRemActivity('');
                setShowRemedialModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekam Remedial</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEnrTopic('');
                setEnrActivity('');
                setEnrNotes('');
                setShowEnrichmentModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekam Pengayaan</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Segmented Control Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('remedial')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'remedial'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-700" />
          <span>Program Remedial ({remedials.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('enrichment')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'enrichment'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Program Pengayaan ({enrichments.length})</span>
        </button>
      </div>

      {/* Konten Tab Remedial */}
      {activeTab === 'remedial' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Tujuan Pembelajaran Belum Tercapai</th>
                  <th className="py-3 px-4">Bentuk Kegiatan Remedial</th>
                  <th className="py-3 px-4 text-center">Skor Awal</th>
                  <th className="py-3 px-4 text-center">Skor Akhir</th>
                  <th className="py-3 px-4">Hasil & Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Memuat data remedial...
                    </td>
                  </tr>
                ) : remedials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada siswa yang memerlukan remedial. Seluruh peserta didik tuntas KKTP.
                    </td>
                  </tr>
                ) : (
                  remedials.map((r) => {
                    const asg = r.assignment || assignments.find((a) => a.id === r.assignment_id);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.student?.full_name || 'Siswa'}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            NIS: {r.student?.nis || '-'}
                            {asg ? ` · ${asg.class?.name || ''} ${asg.subject?.name || ''}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-medium">{r.unachieved_objective}</td>
                        <td className="py-3 px-4 text-slate-600">{r.remedial_activity}</td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-rose-700 font-bold">
                          {r.score_before}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-emerald-800 font-bold bg-emerald-50/50">
                          {r.score_after}
                        </td>
                        <td className="py-3 px-4 text-emerald-900 font-semibold">{r.follow_up_action || 'Tuntas'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Konten Tab Pengayaan */}
      {activeTab === 'enrichment' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                  <th className="py-3 px-4">Nama Siswa Unggul</th>
                  <th className="py-3 px-4">Materi / Topik Pengayaan</th>
                  <th className="py-3 px-4">Bentuk Kegiatan Pendalaman</th>
                  <th className="py-3 px-4 text-center">Tanggal</th>
                  <th className="py-3 px-4">Catatan Kinerja & Karya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Memuat data pengayaan...
                    </td>
                  </tr>
                ) : enrichments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada catatan pengayaan tersimpan.
                    </td>
                  </tr>
                ) : (
                  enrichments.map((e) => {
                    const asg = e.assignment || assignments.find((a) => a.id === e.assignment_id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{e.student?.full_name || 'Siswa'}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            NIS: {e.student?.nis || '-'}
                            {asg ? ` · ${asg.class?.name || ''} ${asg.subject?.name || ''}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-bold">{e.objective_topic}</td>
                        <td className="py-3 px-4 text-slate-600">{e.enrichment_activity}</td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                          {e.execution_date}
                        </td>
                        <td className="py-3 px-4 text-slate-800">{e.result_notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah Remedial */}
      {showRemedialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Catat Program Remedial Siswa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Rekam intervensi perbaikan bagi peserta didik yang belum tuntas kriteria TP.
            </p>

            <form onSubmit={handleCreateRemedial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran & Kelas</label>
                <select
                  value={remAssignmentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setRemAssignmentId(nextId);
                    const nextStds = getStudentsForAssignment(nextId, assignments, students, classMembers);
                    setRemStudentId(nextStds[0]?.id || '');
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {assignments.length === 0 ? (
                    <option value="">Belum ada penugasan mengajar</option>
                  ) : (
                    assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.class?.name || '-'} - {a.subject?.name || 'Mata Pelajaran'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
                <select
                  value={remStudentId}
                  onChange={(e) => setRemStudentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {remModalStudents.length === 0 ? (
                    <option value="">Belum ada siswa terdaftar di rombel ini</option>
                  ) : (
                    remModalStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} (NIS: {s.nis})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TP yang Belum Tercapai</label>
                <input
                  type="text"
                  placeholder="Contoh: TP 1.1: Membedakan ide pokok dan ide pendukung"
                  value={remObjective}
                  onChange={(e) => setRemObjective(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bentuk Pembelajaran Remedial</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pendampingan tutor sebaya dan latihan terbimbing berbasis LKPD bergradasi..."
                  value={remActivity}
                  onChange={(e) => setRemActivity(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai Semula</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={remScoreBefore}
                    onChange={(e) => setRemScoreBefore(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai Sesudah</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={remScoreAfter}
                    onChange={(e) => setRemScoreAfter(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={remDate}
                    onChange={(e) => setRemDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tindak Lanjut / Status</label>
                <input
                  type="text"
                  value={remFollowup}
                  onChange={(e) => setRemFollowup(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRemedialModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Rekam Remedial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengayaan */}
      {showEnrichmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Catat Program Pengayaan Siswa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Dokumentasikan aktivitas eksplorasi tingkat lanjut bagi peserta didik yang melampaui KKTP.
            </p>

            <form onSubmit={handleCreateEnrichment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran & Kelas</label>
                <select
                  value={enrAssignmentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setEnrAssignmentId(nextId);
                    const nextStds = getStudentsForAssignment(nextId, assignments, students, classMembers);
                    setEnrStudentId(nextStds[0]?.id || '');
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {assignments.length === 0 ? (
                    <option value="">Belum ada penugasan mengajar</option>
                  ) : (
                    assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.class?.name || '-'} - {a.subject?.name || 'Mata Pelajaran'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa Unggul</label>
                <select
                  value={enrStudentId}
                  onChange={(e) => setEnrStudentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {enrModalStudents.length === 0 ? (
                    <option value="">Belum ada siswa terdaftar di rombel ini</option>
                  ) : (
                    enrModalStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} (NIS: {s.nis})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Topik Pendalaman</label>
                <input
                  type="text"
                  placeholder="Contoh: Menulis Cerita Fabel Bergambar untuk Mading Madrasah"
                  value={enrTopic}
                  onChange={(e) => setEnrTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bentuk Aktivitas Pengayaan</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsikan penugasan mandiri / riset sederhana / karya kolaboratif..."
                  value={enrActivity}
                  onChange={(e) => setEnrActivity(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Pelaksanaan</label>
                <input
                  type="date"
                  value={enrDate}
                  onChange={(e) => setEnrDate(e.target.value)}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hasil & Apresiasi Guru</label>
                <textarea
                  rows={2}
                  placeholder="Catatan prestasi, kualitas produk hasil belajar..."
                  value={enrNotes}
                  onChange={(e) => setEnrNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEnrichmentModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Rekam Pengayaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
