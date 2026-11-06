import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { Subject } from '../../types/database.types';
import { BookOpen, Plus, Search, CheckCircle, Tag } from 'lucide-react';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<'PAI' | 'Umum' | 'Muatan Lokal' | "Khas Ma'arif">('PAI');
  const [orderIndex, setOrderIndex] = useState<number>(1);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await academicService.getSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('Gagal memuat mata pelajaran:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicService.createSubject({
        code,
        name,
        category,
        order_index: orderIndex,
      });
      setShowModal(false);
      setStatusMessage(`Mata pelajaran ${name} berhasil ditambahkan.`);
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menambah mapel:', err);
    }
  };

  const filteredSubjects = subjects.filter((s) => {
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Mata Pelajaran Madrasah</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kurikulum terintegrasi: Pendidikan Agama Islam (PAI), Khas Ma'arif (Aswaja), Mapel Umum, dan Muatan Lokal.
          </p>
        </div>
        <button
          onClick={() => {
            setCode('');
            setName('');
            setCategory('PAI');
            setOrderIndex(subjects.length + 1);
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Mata Pelajaran</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {[
            { id: 'all', label: 'Semua Kategori' },
            { id: 'PAI', label: 'PAI (Kemenag)' },
            { id: "Khas Ma'arif", label: "Khas Ma'arif (Aswaja)" },
            { id: 'Umum', label: 'Umum (Kemendikbud)' },
            { id: 'Muatan Lokal', label: 'Muatan Lokal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeCategory === tab.id
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau kode mapel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>
      </div>

      {/* Tabel Mata Pelajaran */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4 text-center">Urutan Rapor</th>
                <th className="py-3 px-4">Kode</th>
                <th className="py-3 px-4">Nama Mata Pelajaran</th>
                <th className="py-3 px-4">Kelompok Kurikulum</th>
                <th className="py-3 px-4 text-center">Pedoman</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat mata pelajaran...
                  </td>
                </tr>
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada mata pelajaran yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500 font-bold">
                      {s.order_index}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                      {s.code}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {s.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-600 font-medium">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-[11px] text-slate-500">
                      {s.category === 'PAI' && 'KMA 347 / 450'}
                      {s.category === "Khas Ma'arif" && "LP Ma'arif PWNU Jateng"}
                      {s.category === 'Umum' && 'BSKAP No. 032/H/KR/2024'}
                      {s.category === 'Muatan Lokal' && 'Pergub Jateng'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Mapel */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Tambah Mata Pelajaran</h3>
            <p className="text-xs text-slate-500 mb-4">
              Konfigurasi mata pelajaran dan posisi urutan tampilan pada lembar rapor.
            </p>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Mapel</label>
                  <input
                    type="text"
                    placeholder="Contoh: ASW"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full text-xs font-mono uppercase px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Urutan Rapor</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  placeholder="Contoh: Ke-NU-an / Aswaja"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kelompok Kurikulum</label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as 'PAI' | 'Umum' | 'Muatan Lokal' | "Khas Ma'arif")
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                >
                  <option value="PAI">Pendidikan Agama Islam (PAI)</option>
                  <option value="Khas Ma'arif">Khas Ma'arif (Aswaja An-Nahdliyah)</option>
                  <option value="Umum">Mata Pelajaran Umum</option>
                  <option value="Muatan Lokal">Muatan Lokal (Bahasa Jawa / Inggris)</option>
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
                  Simpan Mata Pelajaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
