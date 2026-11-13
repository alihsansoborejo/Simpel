import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { ClassRoom, Teacher, Student } from '../../types/database.types';
import { School, Users, UserCheck, Plus, Layers, Check, Edit2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState<string>('Kelas 1');
  const [level, setLevel] = useState<number>(1);
  const [phase, setPhase] = useState<'A' | 'B' | 'C'>('A');
  const [capacity, setCapacity] = useState<number>(28);
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cls, tch, std] = await Promise.all([
        academicService.getClasses(),
        academicService.getTeachers(),
        academicService.getStudents(),
      ]);
      setClasses(cls);
      setTeachers(tch);
      setStudents(std);
    } catch (err) {
      console.error('Gagal memuat data kelas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeSync(['simpel_classes', 'simpel_teachers', 'simpel_students', 'simpel_class_members'], () => {
    void loadData();
  });

  const openAddModal = () => {
    setEditingClassId(null);
    setLevel(1);
    setName('Kelas 1');
    setPhase('A');
    setCapacity(28);
    setHomeroomTeacherId('');
    setShowModal(true);
  };

  const openEditModal = (cls: ClassRoom) => {
    setEditingClassId(cls.id);
    setLevel(cls.level);
    setName(cls.name);
    setPhase(cls.phase);
    setCapacity(cls.capacity);
    setHomeroomTeacherId(cls.homeroom_teacher_id || '');
    setShowModal(true);
  };

  const handleLevelChange = (lvl: number) => {
    setLevel(lvl);
    if (!editingClassId) {
      setName(`Kelas ${lvl}`);
    }
    if (lvl === 1 || lvl === 2) setPhase('A');
    else if (lvl === 3 || lvl === 4) setPhase('B');
    else setPhase('C');
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClassId) {
        await academicService.updateClass(editingClassId, {
          name,
          level,
          phase,
          capacity,
          homeroom_teacher_id: homeroomTeacherId || null,
        });
        setStatusMessage(`Rombel ${name} berhasil diperbarui.`);
      } else {
        await academicService.createClass({
          name,
          level,
          phase,
          capacity,
          homeroom_teacher_id: homeroomTeacherId || null,
        });
        setStatusMessage(`Rombel ${name} berhasil ditambahkan.`);
      }
      setShowModal(false);
      loadData();
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menyimpan rombel:', err);
      setStatusMessage('Gagal menyimpan rombel kelas.');
    }
  };

  const handleDeleteClass = async (id: string, className: string) => {
    if (!window.confirm(`Hapus rombel ${className}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await academicService.deleteClass(id);
      setStatusMessage(`Rombel ${className} telah dihapus.`);
      loadData();
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menghapus rombel:', err);
    }
  };

  const formatTeacherName = (t?: Teacher | null): string => {
    if (!t) return 'Belum Ditetapkan';
    return `${t.title_prefix ? `${t.title_prefix} ` : ''}${t.full_name}${t.title_suffix ? `, ${t.title_suffix}` : ''}`.trim();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Memuat data rombongan belajar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Rombongan Belajar (Kelas 1 - 6)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengorganisasian tingkatan kelas sesuai struktur Kurikulum Merdeka Fase A, Fase B, dan Fase C dengan penetapan Wali Kelas.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rombel Kelas</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Info Fase Kurikulum Merdeka */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-900">FASE A</span>
            <span className="text-[11px] text-emerald-700 font-medium">(Kelas 1 & 2)</span>
          </div>
          <p className="text-xs text-emerald-800/80">
            Fokus fondasi literasi, numerasi dasar, adab mulia, dan penanaman Kurikulum Berbasis Cinta.
          </p>
        </div>

        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-amber-900">FASE B</span>
            <span className="text-[11px] text-amber-700 font-medium">(Kelas 3 & 4)</span>
          </div>
          <p className="text-xs text-amber-800/80">
            Penguatan konsep IPAS, nalar kritis, kolaborasi santun, dan pembelajaran mendalam (Deep Learning).
          </p>
        </div>

        <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-900">FASE C</span>
            <span className="text-[11px] text-slate-700 font-medium">(Kelas 5 & 6)</span>
          </div>
          <p className="text-xs text-slate-600">
            Kemandirian belajar, kepemimpinan, pemantapan Aswaja An-Nahdliyah, dan persiapan kelulusan madrasah.
          </p>
        </div>
      </div>

      {/* Grid Kartu Kelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const registeredCount = cls.level === 4 ? students.length : Math.max(18, 28 - cls.level * 2);
          const homeroomName = formatTeacherName(cls.homeroom_teacher);

          return (
            <div
              key={cls.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-sm">
                      {cls.level}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{cls.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span>Fase {cls.phase}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{registeredCount} Siswa</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono tabular-nums font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Maks {cls.capacity}
                    </span>
                    <button
                      onClick={() => openEditModal(cls)}
                      className="p-1 text-slate-400 hover:text-emerald-800 hover:bg-slate-100 rounded transition-colors"
                      title="Ubah Data Rombel & Wali Kelas"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {classes.length > 6 && (
                      <button
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                        className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Hapus Rombel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar Kapasitas */}
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Keterisian Rombel</span>
                    <span>{Math.round((registeredCount / cls.capacity) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 rounded-full"
                      style={{ width: `${Math.min(100, (registeredCount / cls.capacity) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Wali Kelas */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 truncate pr-2">
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-medium truncate" title={homeroomName}>
                    {homeroomName}
                  </span>
                </div>
                <button
                  onClick={() => openEditModal(cls)}
                  className="shrink-0 text-[10px] text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors cursor-pointer"
                  title="Klik untuk memilih/mengubah Wali Kelas"
                >
                  {cls.homeroom_teacher ? 'Wali Kelas' : '+ Pilih Wali'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah/Edit Rombel */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingClassId ? `Ubah Data Rombel ${name}` : 'Tambah Rombel Kelas Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Konfigurasi rombongan belajar, kapasitas kelas, dan penugasan Wali Kelas.
            </p>

            <form onSubmit={handleSaveClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Kelas</label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleLevelChange(lvl)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        level === lvl
                          ? 'border-emerald-800 bg-emerald-800 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Rombel</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              {/* Pilihan Wali Kelas */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wali Kelas (Penanggung Jawab Rombel)
                </label>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => setHomeroomTeacherId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white font-medium text-slate-800"
                >
                  <option value="">-- Pilih Wali Kelas dari Daftar Guru --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTeacherName(t)} {t.specialization ? `(${t.specialization})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Wali kelas memiliki otoritas khusus mencatat absensi harian, memantau nilai rombel, dan mengolah rapor.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fase Kurikulum</label>
                  <select
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as 'A' | 'B' | 'C')}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  >
                    <option value="A">Fase A (Kelas 1-2)</option>
                    <option value="B">Fase B (Kelas 3-4)</option>
                    <option value="C">Fase C (Kelas 5-6)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kapasitas Maksimal</label>
                  <input
                    type="number"
                    min="10"
                    max="40"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
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
                  {editingClassId ? 'Simpan Perubahan' : 'Simpan Rombel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
