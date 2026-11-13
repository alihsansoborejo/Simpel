import React, { useState, useEffect } from 'react';
import { journalService } from '../../services/journalService';
import { academicService } from '../../services/academicService';
import { TeachingJournal, TeachingAssignment } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  ClipboardList,
  Plus,
  Calendar,
  CheckCircle,
  Heart,
  Sparkles,
  Search,
  BookOpen,
  Download,
  Printer,
  Table as TableIcon,
  LayoutList,
  Filter,
} from 'lucide-react';

interface TeachingJournalPageProps {
  onNavigate?: (view: string) => void;
}

export const TeachingJournalPage: React.FC<TeachingJournalPageProps> = ({ onNavigate }) => {
  const { user, activeRole } = useAuth();
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [assignmentId, setAssignmentId] = useState<string>('asg-1');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodHours, setPeriodHours] = useState<string>('Jam ke-1 s.d. 3 (07.00 - 09.00 WIB)');
  const [topic, setTopic] = useState<string>('');
  const [objective, setObjective] = useState<string>('');
  const [activities, setActivities] = useState<string>('');
  const [method, setMethod] = useState<string>('Pembelajaran Mendalam (Deep Learning) & Kolaboratif');
  const [reflection, setReflection] = useState<string>('');
  const [obstacles, setObstacles] = useState<string>('');
  const [followUp, setFollowUp] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jrns, asgs] = await Promise.all([
        journalService.getJournals(),
        academicService.getTeachingAssignments(),
      ]);
      setJournals(jrns);
      setAssignments(asgs);
      if (asgs.length > 0) setAssignmentId(asgs[0].id);
    } catch (err) {
      console.error('Gagal memuat jurnal mengajar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeSync(['simpel_teaching_journals', 'simpel_assignments'], () => {
    void loadData();
  });

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await journalService.createJournal({
        assignment_id: assignmentId,
        date,
        period_hours: periodHours,
        topic,
        learning_objective: objective,
        learning_activities: activities,
        learning_method: method,
        reflection: reflection || null,
        obstacles: obstacles || null,
        follow_up: followUp || null,
        notes: notes || null,
      });
      setShowModal(false);
      setStatusMessage('Jurnal mengajar harian berhasil disimpan ke database.');
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan jurnal:', err);
    }
  };

  const filteredJournals = journals.filter((j) => {
    const matchesAssignment =
      selectedAssignmentFilter === 'all' || j.assignment_id === selectedAssignmentFilter;
    const matchesSearch =
      j.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.learning_objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.date.includes(searchTerm);
    return matchesAssignment && matchesSearch;
  });

  // Ekspor ke format CSV / Excel
  const exportToCSV = () => {
    const headers = [
      'No',
      'Tanggal KBM',
      'Kelas',
      'Mata Pelajaran',
      'Jam Pelajaran',
      'Materi / Topik',
      'Tujuan Pembelajaran (TP)',
      'Aktivitas KBM & Metode',
      'Refleksi Kurikulum Berbasis Cinta',
      'Kendala Belajar',
      'Rencana Tindak Lanjut',
    ];

    const rows = filteredJournals.map((j, idx) => [
      idx + 1,
      j.date,
      `"${j.assignment?.class?.name || 'Kelas 4'}"`,
      `"${j.assignment?.subject?.name || 'Mapel'}"`,
      `"${j.period_hours}"`,
      `"${j.topic.replace(/"/g, '""')}"`,
      `"${j.learning_objective.replace(/"/g, '""')}"`,
      `"${(j.learning_activities + ' | ' + j.learning_method).replace(/"/g, '""')}"`,
      `"${(j.reflection || '').replace(/"/g, '""')}"`,
      `"${(j.obstacles || '-').replace(/"/g, '""')}"`,
      `"${(j.follow_up || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `jurnal_mengajar_mi_al_ihsan_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const tableRows = filteredJournals.map((j, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="center font-mono">${j.date}</td>
        <td><strong>${j.assignment?.subject?.name || 'Mata Pelajaran'}</strong><br><small>${j.assignment?.class?.name || 'Kelas 4'}</small></td>
        <td>${j.topic}</td>
        <td>${j.learning_activities}</td>
        <td><span style="color:#047857;font-weight:bold;">${j.learning_method || '-'}</span></td>
        <td>Jam: ${j.period_hours || '-'}<br><small>Hambatan: ${j.obstacles || 'Nihil'}</small></td>
      </tr>
    `).join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">No</th>
            <th style="width: 80px;">Tanggal KBM</th>
            <th style="width: 140px;">Mata Pelajaran & Kelas</th>
            <th>Materi Pokok Pembelajaran</th>
            <th>Aktivitas KBM (Deep Learning)</th>
            <th style="width: 130px;">Nilai KBC</th>
            <th style="width: 140px;">Presensi & Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printDocumentDirectly(contentHtml, {
      title: 'BUKU JURNAL MENGAJAR HARIAN GURU',
      subtitle: 'Tahun Ajaran 2025/2026 - Berbasis Kurikulum Cinta (KBC) & Pembelajaran Mendalam',
      metadata: [
        { label: 'Tahun Pelajaran', value: '2025/2026 (Semester Ganjil)' },
        { label: 'Total Pertemuan', value: `${filteredJournals.length} Catatan Jurnal KBM` },
        { label: 'Pendekatan', value: 'Kurikulum Berbasis Cinta (KBC)' },
        { label: 'Tanggal Cetak', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: 'Guru Pengampu Mata Pelajaran,',
        leftName: user?.profile?.full_name || 'Ust. Ahmad Fauzi, S.Pd.I',
        leftNip: '198503122019031008',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: 'MUIN, S.Pd.I',
        rightNip: '197508152005011004',
      },
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Jurnal Mengajar Harian Guru (Tabel & Rekap)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan langsung KBM dengan metode Pembelajaran Mendalam dan Kurikulum Berbasis Cinta, siap diekspor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('asisten-ai-refleksi')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Konsultasi kendala kelas dan solusi dengan Asisten AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-950" />
              <span>Analisis Refleksi AI</span>
            </button>
          )}

          {/* Tombol Ekspor CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Unduh format spreadsheet CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel / CSV</span>
          </button>

          {/* Tombol Cetak / PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Cetak atau simpan sebagai dokumen PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>

          {/* Tombol Entri Baru */}
          <button
            onClick={() => {
              setTopic('');
              setObjective('');
              setActivities('');
              setReflection('');
              setObstacles('');
              setFollowUp('');
              setNotes('');
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Isi Jurnal Baru</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200 print:hidden">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header Cetak Formal (Hanya tampil saat dicetak) */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h2 className="text-lg font-bold text-slate-900 uppercase">
          REKAPITULASI JURNAL MENGAJAR HARIAN GURU
        </h2>
        <h3 className="text-sm font-semibold text-slate-800">
          MI MA’ARIF AL IHSAN SOBOREJO · TAHUN PELAJARAN 2026/2027
        </h3>
        <p className="text-xs text-slate-600 mt-0.5">
          Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah · Dicetak pada: {new Date().toLocaleDateString('id-ID')}
        </p>
      </div>

      {/* Toolbar Filter & Mode Tampilan */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Mapel/Rombel */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Mapel / Rombel:</span>
            <select
              value={selectedAssignmentFilter}
              onChange={(e) => setSelectedAssignmentFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
            >
              <option value="all">Semua Mata Pelajaran</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.class?.name || 'Kelas 4'} - {a.subject?.name || 'Mapel'}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Mode Tampilan */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel / List</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Kartu Rinci</span>
            </button>
          </div>
        </div>

        {/* Pencarian */}
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari materi, TP, atau tanggal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>
      </div>

      {/* Tampilan 1: Tabel / List Terstruktur (Exportable) */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-3.5 w-10 text-center font-mono">No</th>
                  <th className="py-3 px-3.5 w-24">Tanggal</th>
                  <th className="py-3 px-3.5 w-36">Kelas & Mapel</th>
                  <th className="py-3 px-3.5 w-48">Materi Pokok / Topik</th>
                  <th className="py-3 px-3.5">Tujuan & Aktivitas KBM</th>
                  <th className="py-3 px-3.5 w-44">Refleksi Berbasis Cinta</th>
                  <th className="py-3 px-3.5 w-36">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Memuat jurnal mengajar...
                    </td>
                  </tr>
                ) : filteredJournals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Tidak ada data jurnal mengajar yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredJournals.map((j, idx) => (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="py-3 px-3.5 text-center font-mono tabular-nums text-slate-400 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono tabular-nums text-slate-800">
                        <div className="font-bold">{j.date}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{j.period_hours}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{j.assignment?.subject?.name || 'Mapel'}</div>
                        <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                          {j.assignment?.class?.name || 'Kelas 4'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900 leading-snug">
                        {j.topic}
                      </td>
                      <td className="py-3 px-3.5 space-y-1">
                        <p className="text-slate-800 leading-relaxed font-medium">
                          {j.learning_objective}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {j.learning_activities}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                          <Sparkles className="w-3 h-3" />
                          <span>{j.learning_method}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="p-2 rounded bg-emerald-50/60 border border-emerald-100/80 text-[11px] text-slate-700 italic leading-relaxed">
                          "{j.reflection || 'Pembelajaran berlangsung kondusif dan hangat.'}"
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-[11px]">
                        <div className="font-semibold text-slate-800">{j.follow_up || '-'}</div>
                        {j.obstacles && (
                          <div className="text-slate-500 mt-1">
                            <span className="font-medium text-amber-800">Kendala: </span>
                            {j.obstacles}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tampilan 2: Kartu Rinci */
        <div className="space-y-4">
          {filteredJournals.map((j) => (
            <div
              key={j.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-200 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{j.topic}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-emerald-800">
                        {j.assignment?.subject?.name || 'Bahasa Indonesia'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{j.assignment?.class?.name || 'Kelas 4'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{j.date}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 self-start sm:self-auto font-medium">
                  {j.period_hours}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">Tujuan Pembelajaran:</span>
                    <p className="text-slate-600 leading-relaxed">{j.learning_objective}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">Aktivitas KBM & Metode:</span>
                    <p className="text-slate-600 leading-relaxed">{j.learning_activities}</p>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{j.learning_method}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-lg border border-slate-100">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-800 font-semibold mb-0.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      <span>Refleksi Kurikulum Berbasis Cinta:</span>
                    </div>
                    <p className="text-slate-600 italic leading-relaxed">
                      "{j.reflection || 'Pembelajaran berjalan hangat, siswa saling menghargai pendapat.'}"
                    </p>
                  </div>
                  {j.obstacles && (
                    <div>
                      <span className="font-semibold text-slate-700 block mb-0.5">Kendala:</span>
                      <p className="text-slate-600">{j.obstacles}</p>
                    </div>
                  )}
                  {j.follow_up && (
                    <div>
                      <span className="font-semibold text-slate-700 block mb-0.5">Rencana Tindak Lanjut:</span>
                      <p className="text-slate-600">{j.follow_up}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bagian Tanda Tangan Cetak Formal (Hanya tampil saat dicetak) */}
      <div className="hidden print:grid grid-cols-2 gap-8 pt-8 text-xs text-center">
        <div>
          <p>Mengetahui,</p>
          <p className="font-bold">Kepala MI Ma’arif Al Ihsan Soborejo</p>
          <div className="h-16" />
          <p className="font-bold underline">Drs. H. Ahmad Ihsan, M.Pd.I</p>
          <p className="font-mono">NIP. 197508122005011003</p>
        </div>
        <div>
          <p>Soborejo, {new Date().toLocaleDateString('id-ID')}</p>
          <p className="font-bold">Guru Pengampu</p>
          <div className="h-16" />
          <p className="font-bold underline">Ust. Ahmad Fauzi, S.Pd.I</p>
          <p className="font-mono">NIP. 198204152010011015</p>
        </div>
      </div>

      {/* Modal Entri Jurnal Mengajar Baru */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-base font-bold text-slate-900 mb-1">Entri Jurnal Mengajar Harian</h3>
            <p className="text-xs text-slate-500 mb-4">
              Isi data pelaksanaan pembelajaran langsung di aplikasi SIMPEL MI Al Ihsan.
            </p>

            <form onSubmit={handleCreateJournal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran & Kelas</label>
                  <select
                    value={assignmentId}
                    onChange={(e) => setAssignmentId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                    required
                  >
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.class?.name || 'Kelas 4'} - {a.subject?.name || 'Mapel'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal KBM</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Pelajaran</label>
                  <input
                    type="text"
                    value={periodHours}
                    onChange={(e) => setPeriodHours(e.target.value)}
                    placeholder="Contoh: Jam ke-1 s.d. 3 (07.00 - 09.00 WIB)"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model / Metode Pembelajaran</label>
                  <input
                    type="text"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    placeholder="Contoh: Pembelajaran Mendalam (Deep Learning)"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Materi Pokok / Topik Bahasan</label>
                <input
                  type="text"
                  placeholder="Contoh: Membaca Terbimbing Teks Narasi Kasih Sayang"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tujuan Pembelajaran (TP)</label>
                <textarea
                  rows={2}
                  placeholder="Tuliskan tujuan pembelajaran yang dicapai pada sesi KBM ini..."
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rincian Aktivitas KBM</label>
                <textarea
                  rows={3}
                  placeholder="1. Pendahuluan & salam cinta madrasah. 2. Kegiatan inti membaca & eksplorasi. 3. Refleksi & doa penutup..."
                  value={activities}
                  onChange={(e) => setActivities(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refleksi Pembelajaran (Kurikulum Berbasis Cinta)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan kehangatan suasana kelas, respon antusias santri, dan nilai kasih sayang..."
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kendala / Hambatan</label>
                  <textarea
                    rows={2}
                    placeholder="Kendala pemahaman siswa jika ada..."
                    value={obstacles}
                    onChange={(e) => setObstacles(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rencana Tindak Lanjut</label>
                  <textarea
                    rows={2}
                    placeholder="Tindak lanjut untuk pertemuan berikutnya..."
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
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
                  Simpan Jurnal Mengajar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
