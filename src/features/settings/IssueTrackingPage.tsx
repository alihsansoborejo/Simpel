import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertOctagon,
  AlertTriangle,
  MessageSquare,
  Send,
  User,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

export type IssuePriority = 'Kritis' | 'Tinggi' | 'Sedang' | 'Rendah';
export type IssueStatus = 'Baru' | 'Dalam Pemeriksaan' | 'Dalam Perbaikan' | 'Selesai' | 'Tidak Dapat Direproduksi';

export interface IssueReport {
  id: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: string;
  moduleName: string;
  priority: IssuePriority;
  status: IssueStatus;
  description: string;
  stepsToReproduce: string;
  createdAt: string;
  resolutionNotes?: string;
  resolvedAt?: string;
}

const STORAGE_KEY = 'simpel_mi_issue_reports';

const INITIAL_ISSUES: IssueReport[] = [
  {
    id: 'ISS-001',
    reporterName: 'Ust. Ahmad Fauzi, S.Pd.I',
    reporterEmail: 'guru@alihsan.sch.id',
    reporterRole: 'guru',
    moduleName: 'Penilaian (Sumatif Tengah Semester)',
    priority: 'Sedang',
    status: 'Selesai',
    description: 'Format cetak leger nilai perlu diperluas agar memuat kolom rincian STS dan SAS secara berdampingan.',
    stepsToReproduce: 'Masuk ke Perangkat Evaluasi -> STS -> Rekap Nilai -> Klik Cetak Leger.',
    createdAt: '2026-11-08T09:30:00Z',
    resolutionNotes: 'Sudah disesuaikan pada Tahap 7 dengan matriks lingkup materi LM1-LM4 serta tombol STS dan SAS.',
    resolvedAt: '2026-11-08T14:00:00Z',
  },
  {
    id: 'ISS-002',
    reporterName: 'MUIN, S.Pd.I',
    reporterEmail: 'kamad@alihsan.sch.id',
    reporterRole: 'kepala_madrasah',
    moduleName: 'Supervisi Akademik & KBM',
    priority: 'Tinggi',
    status: 'Selesai',
    description: 'Dibutuhkan kolom catatan bimbingan profesional langsung saat mereview berkas modul ajar.',
    stepsToReproduce: 'Buka Arsip Google Drive -> Klik Telaah -> Masukkan catatan bimbingan.',
    createdAt: '2026-11-08T10:15:00Z',
    resolutionNotes: 'Modal telaah dokumen dan instrumen supervisi klinis telah disempurnakan dengan rekomendasi konstruktif.',
    resolvedAt: '2026-11-08T15:30:00Z',
  },
];

export const IssueTrackingPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null);

  // Form State
  const [moduleName, setModuleName] = useState('Presensi Siswa Harian');
  const [priority, setPriority] = useState<IssuePriority>('Sedang');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Admin Response State
  const [updateStatus, setUpdateStatus] = useState<IssueStatus>('Dalam Pemeriksaan');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const loadIssues = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setIssues(JSON.parse(raw));
      } else {
        setIssues(INITIAL_ISSUES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ISSUES));
      }
    } catch {
      setIssues(INITIAL_ISSUES);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const saveIssuesToStorage = (updated: IssueReport[]) => {
    setIssues(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const newReport: IssueReport = {
      id: `ISS-${String(issues.length + 1).padStart(3, '0')}`,
      reporterName: user?.profile?.full_name || 'Pengguna Madrasah',
      reporterEmail: user?.email || 'user@alihsan.sch.id',
      reporterRole: activeRole,
      moduleName,
      priority,
      status: 'Baru',
      description,
      stepsToReproduce: steps,
      createdAt: new Date().toISOString(),
    };

    const updated = [newReport, ...issues];
    saveIssuesToStorage(updated);
    setShowAddModal(false);
    setDescription('');
    setSteps('');
    setStatusMessage('Laporan kendala berhasil dikirim ke Administrator dan Tim Teknis.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    const updated = issues.map((item) => {
      if (item.id === selectedIssue.id) {
        return {
          ...item,
          status: updateStatus,
          resolutionNotes: resolutionNotes || item.resolutionNotes,
          resolvedAt: updateStatus === 'Selesai' ? new Date().toISOString() : item.resolvedAt,
        };
      }
      return item;
    });

    saveIssuesToStorage(updated);
    setSelectedIssue(null);
    setStatusMessage(`Status kendala #${selectedIssue.id} berhasil diperbarui menjadi "${updateStatus}".`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const filteredIssues = issues.filter((iss) => {
    if (filterPriority !== 'all' && iss.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && iss.status !== filterStatus) return false;
    if (searchTerm) {
      const match =
        iss.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        iss.moduleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        iss.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        iss.id.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  const getPriorityBadge = (p: IssuePriority) => {
    switch (p) {
      case 'Kritis':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Kritis</span>;
      case 'Tinggi':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Tinggi</span>;
      case 'Sedang':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Sedang</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Rendah</span>;
    }
  };

  const getStatusBadge = (s: IssueStatus) => {
    switch (s) {
      case 'Selesai':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Selesai</span>
          </span>
        );
      case 'Dalam Perbaikan':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Clock className="w-3 h-3 text-indigo-600" />
            <span>Perbaikan</span>
          </span>
        );
      case 'Dalam Pemeriksaan':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pemeriksaan</span>
          </span>
        );
      case 'Tidak Dapat Direproduksi':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
            <span>Tidak Direpro</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span>Baru</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-emerald-800" />
            <span>Pusat Evaluasi & Pelaporan Kendala Operasional</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kanal resmi pencatatan masalah teknis, bugs, dan usulan penyempurnaan selama masa uji coba operasional (Tahap 8).
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Laporkan Kendala Baru</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kendala, pelapor, atau modul..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>

        <div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          >
            <option value="all">Semua Tingkat Prioritas</option>
            <option value="Kritis">Kritis</option>
            <option value="Tinggi">Tinggi</option>
            <option value="Sedang">Sedang</option>
            <option value="Rendah">Rendah</option>
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          >
            <option value="all">Semua Status Penanganan</option>
            <option value="Baru">Baru</option>
            <option value="Dalam Pemeriksaan">Dalam Pemeriksaan</option>
            <option value="Dalam Perbaikan">Dalam Perbaikan</option>
            <option value="Selesai">Selesai</option>
            <option value="Tidak Dapat Direproduksi">Tidak Dapat Direproduksi</option>
          </select>
        </div>
      </div>

      {/* Tabel Laporan Kendala */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4">ID & Pelapor</th>
                <th className="py-3 px-4">Modul & Deskripsi Kendala</th>
                <th className="py-3 px-4 text-center">Prioritas</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada catatan kendala yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((iss) => (
                  <tr key={iss.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-emerald-800 font-bold block">{iss.id}</span>
                      <span className="font-semibold text-slate-900 block">{iss.reporterName}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{iss.reporterRole.replace('_', ' ')}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{iss.moduleName}</span>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{iss.description}</p>
                      {iss.resolutionNotes && (
                        <div className="mt-1 p-1.5 rounded bg-emerald-50 text-[10px] text-emerald-900 border border-emerald-200">
                          <strong>Solusi:</strong> {iss.resolutionNotes}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">{getPriorityBadge(iss.priority)}</td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(iss.status)}</td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedIssue(iss);
                          setUpdateStatus(iss.status);
                          setResolutionNotes(iss.resolutionNotes || '');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 rounded-md border border-emerald-200 transition-colors"
                      >
                        {activeRole === 'admin' ? 'Tindak Lanjut' : 'Detail'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Kendala */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Laporkan Kendala atau Masukan</h3>
            <p className="text-xs text-slate-500 mb-4">
              Informasikan kendala yang dihadapi agar tim teknis madrasah dapat segera melakukan verifikasi dan perbaikan.
            </p>

            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Modul Terkait</label>
                <select
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  <option value="Presensi Siswa Harian">Presensi Siswa Harian</option>
                  <option value="Jurnal Mengajar Guru">Jurnal Mengajar Guru</option>
                  <option value="Arsip Dokumen Google Drive">Arsip Dokumen Google Drive</option>
                  <option value="Perangkat Pembelajaran (CP/TP/ATP/Modul/LKPD)">Perangkat Pembelajaran (CP/TP/ATP/Modul/LKPD)</option>
                  <option value="Perangkat Evaluasi & Penilaian (LM/STS/SAS)">Perangkat Evaluasi & Penilaian (LM/STS/SAS)</option>
                  <option value="Remedial, Pengayaan & Analisis Nilai">Remedial, Pengayaan & Analisis Nilai</option>
                  <option value="Supervisi Akademik & KBM">Supervisi Akademik & KBM</option>
                  <option value="Asisten AI Gemini">Asisten AI Gemini</option>
                  <option value="Manajemen Rombel & Penugasan Mengajar">Manajemen Rombel & Penugasan Mengajar</option>
                  <option value="Impor / Ekspor Excel">Impor / Ekspor Excel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Prioritas</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IssuePriority)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                >
                  <option value="Sedang">Sedang (Tidak menghambat alur kerja utama)</option>
                  <option value="Rendah">Rendah (Penyempurnaan tampilan / saran)</option>
                  <option value="Tinggi">Tinggi (Fitur tidak berjalan pada kondisi tertentu)</option>
                  <option value="Kritis">Kritis (Sistem terhenti / data tidak tersimpan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Kendala</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan apa yang terjadi secara ringkas..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Langkah Terjadinya Masalah</label>
                <textarea
                  rows={2}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="Contoh: 1. Buka menu nilai -> 2. Pilih LM2 -> 3. Klik simpan -> Muncul pesan error..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
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
                  Kirim Laporan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tindak Lanjut Admin */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Tindak Lanjut Kendala #{selectedIssue.id}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Pelapor: <strong>{selectedIssue.reporterName}</strong> ({selectedIssue.moduleName})
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 mb-4">
              <p className="font-semibold text-slate-900">Deskripsi:</p>
              <p className="text-slate-700">{selectedIssue.description}</p>
              {selectedIssue.stepsToReproduce && (
                <p className="text-[11px] text-slate-500 pt-1">
                  <strong>Langkah:</strong> {selectedIssue.stepsToReproduce}
                </p>
              )}
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Penanganan</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as IssueStatus)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                >
                  <option value="Baru">Baru</option>
                  <option value="Dalam Pemeriksaan">Dalam Pemeriksaan</option>
                  <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                  <option value="Selesai">Selesai (Sudah Diatasi)</option>
                  <option value="Tidak Dapat Direproduksi">Tidak Dapat Direproduksi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Penyelesaian</label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Jelaskan tindakan perbaikan yang telah dilakukan..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Perubahan Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
