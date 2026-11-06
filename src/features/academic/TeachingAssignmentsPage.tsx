import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { TeachingAssignment, Teacher, ClassRoom, Subject } from '../../types/database.types';
import { ClipboardList, Plus, Search, CheckCircle, GraduationCap, School, BookOpen } from 'lucide-react';

export const TeachingAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [asgs, tchs, clss, sbjs] = await Promise.all([
        academicService.getTeachingAssignments(),
        academicService.getTeachers(),
        academicService.getClasses(),
        academicService.getSubjects(),
      ]);
      setAssignments(asgs);
      setTeachers(tchs);
      setClasses(clss);
      setSubjects(sbjs);
      if (tchs.length > 0) setSelectedTeacherId(tchs[0].id);
      if (clss.length > 0) setSelectedClassId(clss[0].id);
      if (sbjs.length > 0) setSelectedSubjectId(sbjs[0].id);
    } catch (err) {
      console.error('Gagal memuat penugasan mengajar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicService.createTeachingAssignment({
        teacher_id: selectedTeacherId,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        academic_year_id: 'ay-2026',
        semester_id: 'sem-ganjil-2026',
      });
      setShowModal(false);
      setStatusMessage('Penugasan mengajar berhasil disimpan.');
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan penugasan:', err);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (selectedClass !== 'all' && a.class_id !== selectedClass) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Penugasan Guru Mengajar (SK KBM)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Distribusi beban mengajar pendidik per rombel dan mata pelajaran untuk semester berjalan.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tetapkan Penugasan Baru</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter Rombel */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-700">Filter Rombel:</span>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
        >
          <option value="all">Semua Rombel (Kelas 1 - 6)</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (Fase {c.phase})
            </option>
          ))}
        </select>
      </div>

      {/* Tabel Penugasan */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Rombel Kelas</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4">Kelompok</th>
                <th className="py-3 px-4">Pendidik Pengampu</th>
                <th className="py-3 px-4 text-center">Tahun Pelajaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat data penugasan...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada penugasan mengajar yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {a.class?.name || 'Kelas -'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{a.subject?.name || 'Mapel -'}</div>
                      <div className="text-[11px] text-slate-400 font-mono font-medium">{a.subject?.code}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{a.subject?.category || '-'}</td>
                    <td className="py-3 px-4 font-medium text-emerald-900">
                      {a.teacher
                        ? `${a.teacher.title_prefix || ''} ${a.teacher.full_name} ${a.teacher.title_suffix || ''}`
                        : 'Guru Pengampu'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-600">
                      2026/2027 Ganjil
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Penugasan */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Tetapkan Penugasan Mengajar</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tautkan guru pengampu pada rombel kelas dan mata pelajaran tertentu.
            </p>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Tenaga Pendidik</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title_prefix ? `${t.title_prefix} ` : ''}
                      {t.full_name}
                      {t.title_suffix ? `, ${t.title_suffix}` : ''} ({t.specialization || 'Pendidik'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Rombel Kelas</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Fase {c.phase})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Mata Pelajaran</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.code}] {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Penugasan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
