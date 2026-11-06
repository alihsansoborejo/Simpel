import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { ClassRoom, Teacher, Student } from '../../types/database.types';
import { School, Users, UserCheck, Plus, Layers, Check } from 'lucide-react';

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Class Form State
  const [name, setName] = useState<string>('Kelas 1');
  const [level, setLevel] = useState<number>(1);
  const [phase, setPhase] = useState<'A' | 'B' | 'C'>('A');
  const [capacity, setCapacity] = useState<number>(28);

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

  const handleLevelChange = (lvl: number) => {
    setLevel(lvl);
    setName(`Kelas ${lvl}`);
    if (lvl === 1 || lvl === 2) setPhase('A');
    else if (lvl === 3 || lvl === 4) setPhase('B');
    else setPhase('C');
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicService.createClass({
        name,
        level,
        phase,
        capacity,
      });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      console.error('Gagal membuat kelas:', err);
    }
  };

  // Helper untuk mendapatkan wali kelas demo
  const getHomeroomTeacher = (levelNum: number): string => {
    if (levelNum === 4) return 'Ust. Ahmad Fauzi, S.Pd.I';
    if (levelNum === 1) return 'Usth. Siti Khadijah, S.Pd.';
    if (levelNum === 6) return 'Ust. Muhammad Ridwan, S.Pd.';
    return 'Belum Ditetapkan';
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
            Pengorganisasian tingkatan kelas sesuai struktur Kurikulum Merdeka Fase A, Fase B, dan Fase C.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rombel Kelas</span>
        </button>
      </div>

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
          const homeroomName = getHomeroomTeacher(cls.level);

          return (
            <div
              key={cls.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all"
            >
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
                <span className="text-[11px] font-mono tabular-nums font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  Maks {cls.capacity}
                </span>
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

              {/* Wali Kelas */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-medium truncate max-w-[170px]" title={homeroomName}>
                    {homeroomName}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Wali Kelas
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah Rombel */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Tambah Rombel Kelas Baru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Daftarkan rombongan belajar baru untuk tahun ajaran aktif.
            </p>

            <form onSubmit={handleCreateClass} className="space-y-4">
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
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Rombel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
