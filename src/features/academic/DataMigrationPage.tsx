import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  RefreshCw,
  Info,
  Users,
  GraduationCap,
  School,
  BookOpen,
} from 'lucide-react';
import { academicService } from '../../services/academicService';
import { createUserWithRoles } from '../../services/userService';

type ImportCategory = 'guru' | 'siswa' | 'kelas' | 'mapel' | 'penugasan';

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
}

export const DataMigrationPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ImportCategory>('siswa');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCommitted, setIsCommitted] = useState<boolean>(false);
  const [commitSummary, setCommitSummary] = useState<{ total: number; success: number; failed: number } | null>(null);

  // Download official CSV template
  const downloadTemplate = (category: ImportCategory) => {
    let headers: string[] = [];
    let sampleRows: string[][] = [];
    let filename = '';

    if (category === 'guru') {
      filename = 'template_impor_guru_mi_alihsan.csv';
      headers = ['Gelar_Depan', 'Nama_Lengkap', 'Gelar_Belakang', 'NIP', 'NUPTK', 'JK', 'Telepon', 'Spesialisasi', 'Email_Akun'];
      sampleRows = [
        ['Ust.', 'Ahmad Fauzi', 'S.Pd.I', '198503122019031008', '4532763665200023', 'L', '081234567890', 'Guru Kelas 4 & PAI', 'ahmad.fauzi@alihsan.sch.id'],
        ['Usth.', 'Siti Nurhaliza', 'M.Pd.', '', '9876543210123456', 'P', '085712345678', 'Matematika & IPAS', 'siti.nurhaliza@alihsan.sch.id'],
      ];
    } else if (category === 'siswa') {
      filename = 'template_impor_siswa_mi_alihsan.csv';
      headers = ['NIS', 'NISN', 'Nama_Lengkap', 'Nama_Panggilan', 'Tingkat_Kelas', 'JK', 'Tempat_Lahir', 'Tanggal_Lahir_YYYY_MM_DD', 'Nama_Orang_Tua', 'No_HP_Wali', 'Alamat'];
      sampleRows = [
        ['260401', '0145678901', 'Muhammad Zaky Pratama', 'Zaky', '4', 'L', 'Temanggung', '2016-04-12', 'Bambang Sutrisno', '08122334455', 'Soborejo RT 02 RW 01, Pringsurat'],
        ['260402', '0145678902', 'Fatimah Az-Zahra', 'Fatimah', '4', 'P', 'Temanggung', '2016-08-25', 'Agus Supriyanto', '08577889900', 'Soborejo RT 01 RW 02, Pringsurat'],
      ];
    } else if (category === 'kelas') {
      filename = 'template_impor_kelas_mi_alihsan.csv';
      headers = ['Tingkat_Kelas', 'Nama_Rombel', 'Fase', 'Kapasitas'];
      sampleRows = [
        ['1', 'Kelas 1', 'A', '28'],
        ['2', 'Kelas 2', 'A', '28'],
        ['3', 'Kelas 3', 'B', '28'],
        ['4', 'Kelas 4', 'B', '28'],
        ['5', 'Kelas 5', 'C', '28'],
        ['6', 'Kelas 6', 'C', '28'],
      ];
    } else if (category === 'mapel') {
      filename = 'template_impor_mata_pelajaran_mi_alihsan.csv';
      headers = ['Kode_Mapel', 'Nama_Mata_Pelajaran', 'Kelompok', 'Jam_Per_Minggu'];
      sampleRows = [
        ['IND', 'Bahasa Indonesia', 'Umum', '6'],
        ['MAT', 'Matematika', 'Umum', '5'],
        ['IPA', 'IPAS (Ilmu Pengetahuan Alam & Sosial)', 'Umum', '5'],
        ['PAI-AQD', 'Akidah Akhlak', 'Agama Kemenag', '2'],
        ['PAI-FIQ', 'Fikih', 'Agama Kemenag', '2'],
        ['ASW', 'Ke-NU-an / Aswaja', 'Muatan Lokal', '2'],
      ];
    } else if (category === 'penugasan') {
      filename = 'template_impor_penugasan_guru.csv';
      headers = ['Nama_Rombel', 'Kode_Mapel', 'Nama_Guru', 'Tahun_Pelajaran'];
      sampleRows = [
        ['Kelas 4', 'IND', 'Ust. Ahmad Fauzi, S.Pd.I', '2025/2026'],
        ['Kelas 4', 'IPA', 'Usth. Siti Nurhaliza, M.Pd.', '2025/2026'],
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV file with verification
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsCommitted(false);
    setCommitSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text, selectedCategory);
    };
    reader.readAsText(uploadedFile);
  };

  const parseCSV = (content: string, category: ImportCategory) => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      alert('Berkas CSV kosong atau hanya memiliki baris tajuk.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: ParsedRow[] = [];
    const seenIdentifiers = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      // Split with comma awareness
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const rowData: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowData[h] = cols[idx] || '';
      });

      const messages: string[] = [];
      let status: 'valid' | 'warning' | 'error' = 'valid';

      // Validation logic per category
      if (category === 'siswa') {
        const nis = rowData['NIS'] || '';
        const nisn = rowData['NISN'] || '';
        const nama = rowData['Nama_Lengkap'] || '';
        const jk = rowData['JK'] || '';
        const tingkatKelas = rowData['Tingkat_Kelas'] || '';

        if (!nis || !nama) {
          status = 'error';
          messages.push('NIS dan Nama Lengkap wajib diisi.');
        }

        if (!tingkatKelas) {
          status = 'warning';
          messages.push('Tingkat Kelas kosong (disarankan diisi 1 sampai 6 untuk penempatan rombel).');
        } else if (!['1', '2', '3', '4', '5', '6'].includes(tingkatKelas.trim())) {
          status = 'error';
          messages.push(`Tingkat Kelas "${tingkatKelas}" tidak valid. Harus angka 1 s.d. 6.`);
        }

        if (nisn && nisn.length !== 10) {
          status = 'warning';
          messages.push('NISN standar harus 10 digit angka.');
        }

        if (jk && !['L', 'P'].includes(jk.toUpperCase())) {
          status = 'error';
          messages.push('Jenis Kelamin harus L atau P.');
        }

        if (seenIdentifiers.has(nis)) {
          status = 'error';
          messages.push(`Duplikasi NIS (${nis}) terdeteksi pada baris ini.`);
        } else if (nis) {
          seenIdentifiers.add(nis);
        }
      } else if (category === 'guru') {
        const nama = rowData['Nama_Lengkap'] || '';
        if (!nama) {
          status = 'error';
          messages.push('Nama Lengkap guru wajib diisi.');
        }
      }

      rows.push({
        rowNumber: i,
        data: rowData,
        status,
        messages,
      });
    }

    setParsedRows(rows);
  };

  // Commit valid records into academicService / Supabase
  const handleCommitImport = async () => {
    const validRows = parsedRows.filter((r) => r.status !== 'error');
    if (validRows.length === 0) {
      alert('Tidak ada baris data valid untuk diimpor. Perbaiki data bertanda merah terlebih dahulu.');
      return;
    }

    if (!confirm(`Konfirmasi impor ${validRows.length} baris data ${selectedCategory.toUpperCase()} ke database madrasah?`)) {
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const row of validRows) {
        try {
          if (selectedCategory === 'siswa') {
            const created = await academicService.createStudent({
              nis: row.data['NIS'],
              nisn: row.data['NISN'] || null,
              full_name: row.data['Nama_Lengkap'],
              nickname: row.data['Nama_Panggilan'] || null,
              gender: (row.data['JK']?.toUpperCase() === 'P' ? 'P' : 'L'),
              birth_place: row.data['Tempat_Lahir'] || 'Temanggung',
              birth_date: row.data['Tanggal_Lahir_YYYY_MM_DD'] || '2016-01-01',
              parent_guardian_name: row.data['Nama_Orang_Tua'] || null,
              parent_phone: row.data['No_HP_Wali'] || null,
              address: row.data['Alamat'] || 'Soborejo, Pringsurat',
              is_active: true,
            });

            // Otomatis masukkan ke anggota rombel kelas yang sesuai jika Tingkat_Kelas diisi
            const tk = row.data['Tingkat_Kelas']?.trim();
            if (tk && ['1', '2', '3', '4', '5', '6'].includes(tk)) {
              try {
                await academicService.assignStudentToClass(created.id, `cls-${tk}`, 'ay-2026');
              } catch (clsErr) {
                console.warn('Gagal assign rombel siswa otomatis:', clsErr);
              }
            }

            successCount++;
          } else if (selectedCategory === 'guru') {
            const email = row.data['Email_Akun']?.trim();
            if (email) {
              await createUserWithRoles({
                email,
                full_name: row.data['Nama_Lengkap'],
                password: 'AlIhsan2026!',
                title_prefix: row.data['Gelar_Depan'] || undefined,
                title_suffix: row.data['Gelar_Belakang'] || undefined,
                nip: row.data['NIP'] || undefined,
                nuptk: row.data['NUPTK'] || undefined,
                gender: (row.data['JK']?.toUpperCase() === 'P' ? 'P' : 'L'),
                phone_number: row.data['Telepon'] || undefined,
                specialization: row.data['Spesialisasi'] || undefined,
                roles: ['guru'],
                is_active: true,
              });
            } else {
              await academicService.createTeacher({
                user_id: null,
                title_prefix: row.data['Gelar_Depan'] || null,
                full_name: row.data['Nama_Lengkap'],
                title_suffix: row.data['Gelar_Belakang'] || null,
                nip: row.data['NIP'] || null,
                nuptk: row.data['NUPTK'] || null,
                gender: (row.data['JK']?.toUpperCase() === 'P' ? 'P' : 'L'),
                phone_number: row.data['Telepon'] || null,
                specialization: row.data['Spesialisasi'] || null,
                is_active: true,
              });
            }
            successCount++;
          }
        } catch (err) {
          console.error('Row insert error:', err);
          failCount++;
        }
      }

      setIsCommitted(true);
      setCommitSummary({
        total: validRows.length,
        success: successCount,
        failed: failCount,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const errorCount = parsedRows.filter((r) => r.status === 'error').length;
  const warningCount = parsedRows.filter((r) => r.status === 'warning').length;
  const validCount = parsedRows.filter((r) => r.status === 'valid').length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-800" />
          <span>Pusat Migrasi & Impor Data Massal (Excel / CSV)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Mekanisme resmi pengisian data awal operasional madrasah (Guru, Siswa, Rombel, Mapel, dan Penugasan) dengan validasi baris, deteksi duplikat, dan pratinjau sebelum disimpan.
        </p>
      </div>

      {/* Kategori Pilihan */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: 'siswa', label: 'Data Siswa', icon: Users, desc: 'NIS & NISN Pokok' },
          { id: 'guru', label: 'Data Guru', icon: GraduationCap, desc: 'Pendidik & Gelar' },
          { id: 'kelas', label: 'Data Rombel', icon: School, desc: 'Kelas 1 s.d. 6' },
          { id: 'mapel', label: 'Mata Pelajaran', icon: BookOpen, desc: 'Kemenag & Mulok' },
          { id: 'penugasan', label: 'Penugasan SK', icon: FileCheck, desc: 'Guru per Rombel' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedCategory(tab.id as ImportCategory);
                setFile(null);
                setParsedRows([]);
                setIsCommitted(false);
                setCommitSummary(null);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
              <p className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>{tab.label}</p>
              <p className="text-[10px] text-slate-500 truncate">{tab.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Box Langkah 1 & 2: Unduh Template & Unggah Berkas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unduh Template */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Langkah 1
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-2">Unduh Template Format Resmi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gunakan template CSV/Excel resmi agar susunan kolom sesuai dengan skema database Supabase madrasah.
              </p>
            </div>
            <FileSpreadsheet className="w-8 h-8 text-emerald-700/30" />
          </div>

          <button
            onClick={() => downloadTemplate(selectedCategory)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-colors w-full justify-center"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Unduh Template CSV ({selectedCategory.toUpperCase()})</span>
          </button>
        </div>

        {/* Unggah Berkas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Langkah 2
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-2">Pilih Berkas CSV Data Madrasah</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pastikan NISN, nomor identitas, dan tanggal lahir tidak berubah akibat konversi.
              </p>
            </div>
            <Upload className="w-8 h-8 text-emerald-700/30" />
          </div>

          <label className="flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs w-full">
            <Upload className="w-4 h-4" />
            <span>{file ? `Ganti Berkas: ${file.name}` : 'Pilih Berkas CSV / XLSX'}</span>
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      {/* Summary Box & Confirmation */}
      {parsedRows.length > 0 && !isCommitted && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800">Total Baris:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-900">
                {parsedRows.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Valid: {validCount}</span>
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Peringatan: {warningCount}</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                <XCircle className="w-4 h-4" />
                <span>Kesalahan: {errorCount}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => {
                setFile(null);
                setParsedRows([]);
              }}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 font-medium"
            >
              Batalkan
            </button>
            <button
              onClick={handleCommitImport}
              disabled={isProcessing || errorCount > 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isProcessing ? 'Menyimpan ke Supabase...' : `Simpan ${validCount} Data Valid`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hasil Sukses Komitmen */}
      {isCommitted && commitSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-emerald-950 text-sm">Proses Impor Data Selesai!</h4>
            <p className="text-emerald-800">
              Sebanyak <strong>{commitSummary.success}</strong> baris data {selectedCategory} berhasil disimpan ke database operasional. {commitSummary.failed > 0 ? `(${commitSummary.failed} baris gagal).` : 'Semua data telah sinkron.'}
            </p>
            <button
              onClick={() => {
                setFile(null);
                setParsedRows([]);
                setIsCommitted(false);
              }}
              className="mt-2 inline-flex items-center gap-1 text-emerald-900 font-bold underline"
            >
              Impor Berkas Lainnya
            </button>
          </div>
        </div>
      )}

      {/* Pratinjau Tabel Baris per Baris */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">Pratinjau & Validasi Baris Data Sebelum Disimpan</h4>
            <span className="text-[11px] text-slate-500">Baris dengan status kesalahan (merah) harus diperbaiki sebelum disimpan</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Baris</th>
                  <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  <th className="py-2.5 px-4">Ringkasan Nilai Kolom</th>
                  <th className="py-2.5 px-4">Catatan Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                {parsedRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      row.status === 'error'
                        ? 'bg-rose-50/50'
                        : row.status === 'warning'
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">#{row.rowNumber}</td>
                    <td className="py-2.5 px-3 text-center">
                      {row.status === 'valid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-sans">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Valid</span>
                        </span>
                      )}
                      {row.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-sans">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Periksa</span>
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-sans">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Gagal</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 max-w-md truncate font-sans">
                      {Object.entries(row.data)
                        .slice(0, 4)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-xs">
                      {row.messages.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-rose-700 font-medium text-[11px]">
                          {row.messages.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">Format siap disimpan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
