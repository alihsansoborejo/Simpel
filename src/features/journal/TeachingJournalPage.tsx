import React, { useState, useEffect } from 'react';
import { journalService } from '../../services/journalService';
import { academicService } from '../../services/academicService';
import { TeachingJournal, TeachingAssignment } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import {
  ClipboardList,
  Plus,
  Calendar,
  CheckCircle,
  Heart,
  Sparkles,
  Search,
  BookOpen,
} from 'lucide-react';

export const TeachingJournalPage: React.FC = () => {
  const { user } = useAuth();
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
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
      setStatusMessage('Jurnal mengajar harian berhasil disimpan.');
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan jurnal:', err);
    }
  };

  const filteredJournals = journals.filter((j) => {
    return (
      j.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.learning_objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.date.includes(searchTerm)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Jurnal Mengajar Harian Guru</h1>
          <p className="text-xs text-slate-500 mt-1">
            Dokumentasi KBM terstruktur dengan pendekatan Pembelajaran Mendalam dan Kurikulum Berbasis Cinta.
          </p>
        </div>
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
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Isi Jurnal Mengajar Baru</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Toolbar Pencarian */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan topik materi, tujuan pembelajaran, atau tanggal KBM..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
        />
      </div>

      {/* Daftar Jurnal Terstruktur */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Memuat riwayat jurnal mengajar...</div>
        ) : filteredJournals.length === 0 ? (
          <div className="bg-white p-12 text-center border border-slate-200 rounded-xl text-slate-400 text-xs">
            Belum ada catatan jurnal mengajar yang tersimpan.
          </div>
        ) : (
          filteredJournals.map((j) => (
            <div
              key={j.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-200 transition-all space-y-4"
            >
              {/* Header Baris Jurnal */}
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
                <span className="text-[11px] font-mono tabular-nums text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 self-start sm:self-auto">
                  {j.period_hours}
                </span>
              </div>

              {/* Detail KBM */}
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

                <div className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
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
          ))
        )}
      </div>

      {/* Modal Tambah Jurnal */}
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
