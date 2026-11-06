import React, { useState, useEffect } from 'react';
import { assessmentService } from '../../services/assessmentService';
import { academicService } from '../../services/academicService';
import { Assessment, Grade, Student, AssessmentType, TeachingAssignment } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import {
  Award,
  Plus,
  Save,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Calendar,
  Layers,
} from 'lucide-react';

export const GradesPage: React.FC = () => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State: Modal Tambah Asesmen Baru
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<AssessmentType>('Formatif');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newKktp, setNewKktp] = useState<number>(75);
  const [newAssignmentId, setNewAssignmentId] = useState<string>('asg-1');

  // Input Map: studentId -> { score: number, feedback: string }
  const [scoreInputs, setScoreInputs] = useState<Record<string, { score: number; feedback: string }>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [asms, asgs, stds] = await Promise.all([
        assessmentService.getAssessments(),
        academicService.getTeachingAssignments(),
        academicService.getStudents(),
      ]);
      setAssessments(asms);
      setAssignments(asgs);
      setStudents(stds);

      if (asms.length > 0) {
        setSelectedAssessmentId(asms[0].id);
        const grds = await assessmentService.getGrades(asms[0].id);
        setGrades(grds);

        const initialMap: Record<string, { score: number; feedback: string }> = {};
        stds.forEach((s) => {
          const found = grds.find((g) => g.student_id === s.id);
          initialMap[s.id] = {
            score: found ? Number(found.score) : 75,
            feedback: found?.feedback || '',
          };
        });
        setScoreInputs(initialMap);
      }
    } catch (err) {
      console.error('Gagal memuat data penilaian:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectAssessment = async (asmId: string) => {
    setSelectedAssessmentId(asmId);
    try {
      const grds = await assessmentService.getGrades(asmId);
      setGrades(grds);

      const map: Record<string, { score: number; feedback: string }> = {};
      students.forEach((s) => {
        const found = grds.find((g) => g.student_id === s.id);
        map[s.id] = {
          score: found ? Number(found.score) : 75,
          feedback: found?.feedback || '',
        };
      });
      setScoreInputs(map);
    } catch (err) {
      console.error('Gagal memilih asesmen:', err);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await assessmentService.createAssessment({
        assignment_id: newAssignmentId,
        title: newTitle,
        assessment_type: newType,
        assessment_date: newDate,
        kktp: newKktp,
      });
      setShowAddModal(false);
      setStatusMessage(`Asesmen "${newTitle}" berhasil dibuat.`);
      loadData();
      handleSelectAssessment(created.id);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal membuat asesmen:', err);
    }
  };

  const handleScoreChange = (studentId: string, val: number) => {
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: Math.min(100, Math.max(0, val)),
      },
    }));
  };

  const handleFeedbackChange = (studentId: string, text: string) => {
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        feedback: text,
      },
    }));
  };

  const handleSaveGrades = async () => {
    if (!selectedAssessmentId) return;
    setIsSaving(true);
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        score: scoreInputs[s.id]?.score ?? 75,
        feedback: scoreInputs[s.id]?.feedback || null,
      }));

      await assessmentService.saveGrades(selectedAssessmentId, entries);
      setStatusMessage('Nilai siswa berhasil disimpan.');
      const grds = await assessmentService.getGrades(selectedAssessmentId);
      setGrades(grds);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan nilai:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentAsm = assessments.find((a) => a.id === selectedAssessmentId);
  const currentKktp = currentAsm ? Number(currentAsm.kktp) : 75;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Asesmen & Pengolahan Nilai Siswa</h1>
          <p className="text-xs text-slate-500 mt-1">
            Penilaian formatif, sumatif materi, dan perbandingan langsung terhadap Kriteria Ketercapaian Tujuan Pembelajaran (KKTP).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-800" />
            <span>Buat Asesmen Baru</span>
          </button>
          <button
            onClick={handleSaveGrades}
            disabled={isSaving || !selectedAssessmentId}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Nilai'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Pilihan Asesmen Aktif */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-700 block">Pilih Instrumen Asesmen:</span>
            <select
              value={selectedAssessmentId}
              onChange={(e) => handleSelectAssessment(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-emerald-600 mt-0.5"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.assessment_type.replace('_', ' ')}] {a.title} ({a.assessment_date})
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentAsm && (
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <div className="text-right">
              <span className="text-slate-500 block text-[11px]">Ambang KKTP:</span>
              <span className="font-bold text-emerald-900 text-sm">{currentKktp}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[11px]">Tanggal Pelaksanaan:</span>
              <span className="font-bold text-slate-800">{currentAsm.assessment_date}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabel Input Nilai Siswa */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Lengkap Siswa</th>
                <th className="py-3 px-4 w-32 text-center">Nilai (0 - 100)</th>
                <th className="py-3 px-4 w-36 text-center">Ketuntasan KKTP</th>
                <th className="py-3 px-4">Catatan Umpan Balik Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat daftar nilai...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada siswa ditemukan.
                  </td>
                </tr>
              ) : (
                students.map((student, idx) => {
                  const input = scoreInputs[student.id] || { score: 75, feedback: '' };
                  const isPassed = input.score >= currentKktp;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{student.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          NIS: {student.nis}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={input.score}
                          onChange={(e) => handleScoreChange(student.id, Number(e.target.value))}
                          className="w-20 text-center font-mono tabular-nums font-bold text-sm py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isPassed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Tuntas</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Perlu Remedial</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Umpan balik motivasi atau catatan pemahaman..."
                          value={input.feedback}
                          onChange={(e) => handleFeedbackChange(student.id, e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Asesmen Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Buat Asesmen Baru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Daftarkan penilaian baru untuk pengukuran ketercapaian tujuan pembelajaran.
            </p>

            <form onSubmit={handleCreateAssessment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penugasan Mapel & Kelas</label>
                <select
                  value={newAssignmentId}
                  onChange={(e) => setNewAssignmentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.class?.name || 'Kelas 4'} - {a.subject?.name || 'Bahasa Indonesia'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Asesmen</label>
                <input
                  type="text"
                  placeholder="Contoh: Formatif 2 - Kosakata Baku dan EYD"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Asesmen</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as AssessmentType)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  >
                    <option value="Formatif">Formatif</option>
                    <option value="Sumatif_Lingkup_Materi">Sumatif Lingkup Materi</option>
                    <option value="Sumatif_Tengah_Semester">Sumatif Tengah Semester</option>
                    <option value="Sumatif_Akhir_Semester">Sumatif Akhir Semester</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kriteria Tuntas (KKTP)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={newKktp}
                    onChange={(e) => setNewKktp(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Asesmen</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Asesmen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
