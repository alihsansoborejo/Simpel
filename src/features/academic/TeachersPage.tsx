import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { Teacher } from '../../types/database.types';
import { GraduationCap, Search, Plus, Edit2, Trash2, CheckCircle, Phone, Award } from 'lucide-react';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export const TeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Edit / Form State
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [titlePrefix, setTitlePrefix] = useState<string>('Ust.');
  const [titleSuffix, setTitleSuffix] = useState<string>('S.Pd.I');
  const [nip, setNip] = useState<string>('');
  const [nuptk, setNuptk] = useState<string>('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [phone, setPhone] = useState<string>('081234567890');
  const [specialization, setSpecialization] = useState<string>('Guru Kelas & PAI');
  const [isActive, setIsActive] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await academicService.getTeachers();
      setTeachers(data);
    } catch (err) {
      console.error('Gagal memuat data guru:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeSync(['simpel_teachers', 'simpel_users_cache_v2'], () => {
    void loadData();
  });

  const openAddModal = () => {
    setEditingTeacherId(null);
    setFullName('');
    setTitlePrefix('Ust.');
    setTitleSuffix('S.Pd.I');
    setNip('');
    setNuptk('');
    setGender('L');
    setPhone('081234567890');
    setSpecialization('Guru Kelas & PAI');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditingTeacherId(t.id);
    setFullName(t.full_name);
    setTitlePrefix(t.title_prefix || '');
    setTitleSuffix(t.title_suffix || '');
    setNip(t.nip || '');
    setNuptk(t.nuptk || '');
    setGender(t.gender);
    setPhone(t.phone_number || '');
    setSpecialization(t.specialization || '');
    setIsActive(t.is_active);
    setShowModal(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeacherId) {
        await academicService.updateTeacher(editingTeacherId, {
          full_name: fullName,
          title_prefix: titlePrefix || null,
          title_suffix: titleSuffix || null,
          nip: nip || null,
          nuptk: nuptk || null,
          gender,
          phone_number: phone || null,
          specialization,
          is_active: isActive,
        });
        setStatusMessage(`Data ustadz/ustadzah ${fullName} berhasil diperbarui.`);
      } else {
        await academicService.createTeacher({
          user_id: null,
          full_name: fullName,
          title_prefix: titlePrefix || null,
          title_suffix: titleSuffix || null,
          nip: nip || null,
          nuptk: nuptk || null,
          gender,
          phone_number: phone || null,
          specialization,
          is_active: true,
        });
        setStatusMessage(`Data ustadz/ustadzah ${fullName} berhasil ditambahkan.`);
      }
      setShowModal(false);
      loadData();
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menyimpan guru:', err);
      setStatusMessage('Terjadi kesalahan saat menyimpan data pendidik.');
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!window.confirm(`Hapus data tenaga pendidik ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await academicService.deleteTeacher(id);
      setStatusMessage(`Data ${name} telah dihapus.`);
      loadData();
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menghapus guru:', err);
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    const combinedName = `${t.title_prefix || ''} ${t.full_name} ${t.title_suffix || ''}`.toLowerCase();
    return (
      combinedName.includes(searchTerm.toLowerCase()) ||
      (t.nip && t.nip.includes(searchTerm)) ||
      (t.nuptk && t.nuptk.includes(searchTerm)) ||
      (t.specialization && t.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Master Tenaga Pendidik</h1>
          <p className="text-xs text-slate-500 mt-1">
            Data ustadz dan ustadzah MI Ma’arif Al Ihsan Soborejo dengan kualifikasi dan penugasan akademik.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Tenaga Pendidik</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Pencarian */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan nama ustadz/ustadzah, NIP, NUPTK, atau bidang mata pelajaran..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
        />
      </div>

      {/* Tabel Guru */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Nama Lengkap & Gelar</th>
                <th className="py-3 px-4">NIP / NUPTK</th>
                <th className="py-3 px-4 text-center">L/P</th>
                <th className="py-3 px-4">Spesialisasi Pengajaran</th>
                <th className="py-3 px-4">Kontak Telepon</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Memuat data pendidik...
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Belum ada data pendidik.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Silakan klik tombol "Tambah Guru" di atas atau impor data dari menu Migrasi Data.</p>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {t.title_prefix ? `${t.title_prefix} ` : ''}
                        {t.full_name}
                        {t.title_suffix ? `, ${t.title_suffix}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      <div className="text-slate-900 font-medium">{t.nip || 'Non-PNS'}</div>
                      <div className="text-[11px] text-slate-400">{t.nuptk ? `NUPTK: ${t.nuptk}` : '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.gender === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                        }`}
                      >
                        {t.gender === 'L' ? 'L' : 'P'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{t.specialization || '-'}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">{t.phone_number || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.is_active
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}
                      >
                        {t.is_active ? 'Aktif Mengajar' : 'Non-Aktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 text-slate-500 hover:text-emerald-800 hover:bg-slate-100 rounded transition-colors"
                          title="Ubah Data Guru"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(t.id, t.full_name)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Hapus Data Guru"
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

      {/* Modal Tambah/Edit Guru */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingTeacherId ? 'Ubah Data Tenaga Pendidik' : 'Tambah Tenaga Pendidik Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Daftarkan dan perbarui data ustadz/ustadzah pengampu kurikulum madrasah.
            </p>

            <form onSubmit={handleSaveTeacher} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gelar Depan</label>
                  <input
                    type="text"
                    value={titlePrefix}
                    placeholder="Ust."
                    onChange={(e) => setTitlePrefix(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gelar Belakang</label>
                  <input
                    type="text"
                    value={titleSuffix}
                    placeholder="S.Pd.I"
                    onChange={(e) => setTitleSuffix(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIP (Jika PNS/P3K)</label>
                  <input
                    type="text"
                    value={nip}
                    placeholder="19820415..."
                    onChange={(e) => setNip(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NUPTK</label>
                  <input
                    type="text"
                    value={nuptk}
                    placeholder="45678912..."
                    onChange={(e) => setNuptk(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon / WA</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Spesialisasi Pengajaran</label>
                <input
                  type="text"
                  value={specialization}
                  placeholder="Guru Kelas 4, PAI, PJOK, dll."
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              {editingTeacherId && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveTeacher"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-800 focus:ring-emerald-600 h-4 w-4"
                  />
                  <label htmlFor="isActiveTeacher" className="text-xs font-medium text-slate-700">
                    Status Aktif Mengajar di Madrasah
                  </label>
                </div>
              )}

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
                  {editingTeacherId ? 'Simpan Perubahan' : 'Simpan Pendidik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
