import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { Student, ClassRoom, ClassMember } from '../../types/database.types';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Users,
  Search,
  Plus,
  Download,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  School,
} from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [nis, setNis] = useState<string>('');
  const [nisn, setNisn] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [assignedClassId, setAssignedClassId] = useState<string>('cls-4');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [birthPlace, setBirthPlace] = useState<string>('Temanggung');
  const [birthDate, setBirthDate] = useState<string>('2016-01-01');
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('Soborejo, Pringsurat');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [std, cls, cm] = await Promise.all([
        academicService.getStudents(),
        academicService.getClasses(),
        academicService.getClassMembers(),
      ]);
      setStudents(std);
      setClasses(cls);
      setClassMembers(cm);
    } catch (err) {
      console.error('Gagal memuat data siswa:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeSync(['simpel_students', 'simpel_classes', 'simpel_class_members'], () => {
    void loadData();
  });

  const openAddModal = () => {
    setEditingStudentId(null);
    setNis(`26040${students.length + 1}`);
    setNisn(`014567890${students.length + 1}`);
    setFullName('');
    setNickname('');
    setAssignedClassId('cls-4');
    setGender('L');
    setBirthPlace('Temanggung');
    setBirthDate('2016-01-01');
    setParentName('');
    setParentPhone('085712345678');
    setAddress('Soborejo, Pringsurat');
    setShowModal(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudentId(student.id);
    setNis(student.nis);
    setNisn(student.nisn || '');
    setFullName(student.full_name);
    setNickname(student.nickname || '');
    const member = classMembers.find((cm) => cm.student_id === student.id);
    setAssignedClassId(member ? member.class_id : 'cls-4');
    setGender(student.gender);
    setBirthPlace(student.birth_place || '');
    setBirthDate(student.birth_date || '2016-01-01');
    setParentName(student.parent_guardian_name || '');
    setParentPhone(student.parent_phone || '');
    setAddress(student.address || '');
    setShowModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudentId) {
        await academicService.updateStudent(editingStudentId, {
          nis,
          nisn: nisn || null,
          full_name: fullName,
          nickname: nickname || null,
          gender,
          birth_place: birthPlace,
          birth_date: birthDate,
          parent_guardian_name: parentName,
          parent_phone: parentPhone,
          address,
        });
        if (assignedClassId) {
          await academicService.assignStudentToClass(editingStudentId, assignedClassId, 'ay-2026');
        }
        setStatusMessage(`Data siswa ${fullName} berhasil diperbarui.`);
      } else {
        const created = await academicService.createStudent({
          nis,
          nisn: nisn || null,
          full_name: fullName,
          nickname: nickname || null,
          gender,
          birth_place: birthPlace,
          birth_date: birthDate,
          parent_guardian_name: parentName,
          parent_phone: parentPhone,
          address,
          is_active: true,
        });
        if (assignedClassId) {
          await academicService.assignStudentToClass(created.id, assignedClassId, 'ay-2026');
        }
        setStatusMessage(`Siswa ${fullName} berhasil ditambahkan ke ${classes.find(c => c.id === assignedClassId)?.name || 'kelas'}.`);
      }
      setShowModal(false);
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan siswa:', err);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!window.confirm(`Hapus data peserta didik ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await academicService.deleteStudent(id);
      setStatusMessage(`Data siswa ${name} telah dihapus.`);
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menghapus siswa:', err);
    }
  };

  const getStudentClassName = (studentId: string): string => {
    const member = classMembers.find((cm) => cm.student_id === studentId);
    if (!member) return 'Belum Diatur';
    const cls = classes.find((c) => c.id === member.class_id);
    return cls ? cls.name : 'Kelas 4';
  };

  const filteredStudents = students.filter((s: Student) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nis.includes(searchTerm) ||
      Boolean(s.nisn && s.nisn.includes(searchTerm));

    if (!matchesSearch) return false;

    if (selectedClassFilter !== 'all') {
      const member = classMembers.find((cm: ClassMember) => cm.student_id === s.id);
      if (!member || member.class_id !== selectedClassFilter) {
        return false;
      }
    }

    return true;
  });

  const handlePrintDocument = () => {
    const filtered = filteredStudents;
    const activeClassName = selectedClassFilter === 'all'
      ? 'Seluruh Tingkat Kelas (1 s.d. 6)'
      : classes.find((c: ClassRoom) => c.id === selectedClassFilter)?.name || selectedClassFilter;

    const tableRows = filtered.map((s: Student, idx: number) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${s.full_name}</strong>${s.nickname ? `<br><small style="color:#64748b;">(${s.nickname})</small>` : ''}</td>
        <td class="center font-mono">${s.nis} / ${s.nisn || '-'}</td>
        <td class="center">${getStudentClassName(s.id)}</td>
        <td class="center font-bold">${s.gender}</td>
        <td>${s.birth_place || '-'}, ${s.birth_date || '-'}</td>
        <td>${s.parent_guardian_name || '-'}<br><small>${s.parent_phone || '-'}</small></td>
        <td class="center"><span style="color:#047857;font-weight:bold;">Aktif</span></td>
      </tr>
    `).join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Lengkap Peserta Didik</th>
            <th>NIS / NISN</th>
            <th style="width: 75px;">Rombel</th>
            <th style="width: 40px;">L/P</th>
            <th>Tempat, Tanggal Lahir</th>
            <th>Nama Orang Tua / Wali</th>
            <th style="width: 60px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printDocumentDirectly(contentHtml, {
      title: 'BUKU INDUK & DAFTAR PESERTA DIDIK',
      subtitle: `Tahun Ajaran 2025/2026 - Rombel: ${activeClassName}`,
      metadata: [
        { label: 'Tahun Ajaran', value: '2025/2026 (Semester Ganjil)' },
        { label: 'Filter Rombel', value: activeClassName },
        { label: 'Total Siswa', value: `${filtered.length} Peserta Didik` },
        { label: 'Tanggal Cetak', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: 'Wali Kelas / Pengelola Data,',
        leftName: 'Ust. Ahmad Fauzi, S.Pd.I',
        leftNip: '198503122019031008',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: 'MUIN, S.Pd.I',
        rightNip: '197508152005011004',
      },
    });
  };

  const exportCSV = () => {
    const headers = ['ID', 'NIS', 'NISN', 'Nama Lengkap', 'Panggilan', 'Tingkat Rombel', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'Nama Wali', 'No HP Wali', 'Alamat'];
    const rows = filteredStudents.map((s: Student) => [
      s.id,
      s.nis,
      s.nisn || '',
      `"${s.full_name}"`,
      s.nickname || '',
      `"${getStudentClassName(s.id)}"`,
      s.gender,
      s.birth_place || '',
      s.birth_date || '',
      `"${s.parent_guardian_name || ''}"`,
      s.parent_phone || '',
      `"${s.address || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `peserta_didik_mi_al_ihsan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Master Peserta Didik</h1>
          <p className="text-xs text-slate-500 mt-1">
            Data pokok siswa MI Ma’arif Al Ihsan Soborejo dengan verifikasi nomor induk dan rombel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Cetak Buku Induk Siswa Resmi Lengkap Kop Madrasah"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF Siap Cetak</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter & Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama santri, NIS, atau NISN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
          >
            <option value="all">Semua Rombel (Kelas 1 s.d. 6)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Fase {c.phase})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel Data Siswa */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Nama Lengkap & Panggilan</th>
                <th className="py-3 px-4">NIS / NISN</th>
                <th className="py-3 px-4">Tingkat Rombel</th>
                <th className="py-3 px-4 text-center">L/P</th>
                <th className="py-3 px-4">Tempat, Tanggal Lahir</th>
                <th className="py-3 px-4">Wali Santri & Telepon</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Memuat data siswa...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Belum ada data peserta didik.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Silakan klik tombol "Tambah Siswa" di atas atau impor data dari menu Migrasi Data.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{s.full_name}</div>
                      {s.nickname && <div className="text-[11px] text-slate-500">Panggilan: {s.nickname}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      <div className="text-slate-900 font-medium">{s.nis}</div>
                      <div className="text-[11px] text-slate-400">{s.nisn || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <School className="w-3 h-3 text-emerald-600" />
                        <span>{getStudentClassName(s.id)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.gender === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                        }`}
                      >
                        {s.gender === 'L' ? 'L' : 'P'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>{s.birth_place || '-'}</div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">{s.birth_date || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{s.parent_guardian_name || '-'}</div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">{s.parent_phone || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                        Aktif
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 text-slate-500 hover:text-emerald-800 hover:bg-slate-100 rounded transition-colors"
                          title="Ubah Data Siswa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id, s.full_name)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Hapus Siswa"
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

      {/* Modal Tambah/Edit Siswa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingStudentId ? 'Ubah Data Peserta Didik' : 'Pendaftaran Peserta Didik Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Lengkapi informasi data pokok siswa sesuai kartu keluarga / akta kelahiran.
            </p>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIS (Nomor Induk Santri)</label>
                  <input
                    type="text"
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NISN (10 Digit)</label>
                  <input
                    type="text"
                    value={nisn}
                    maxLength={10}
                    onChange={(e) => setNisn(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Panggilan</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Rombel</label>
                  <select
                    value={assignedClassId}
                    onChange={(e) => setAssignedClassId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white font-semibold text-emerald-900"
                    required
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp Orang Tua</label>
                  <input
                    type="text"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Tinggal</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
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
                  {editingStudentId ? 'Simpan Perubahan' : 'Daftarkan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
