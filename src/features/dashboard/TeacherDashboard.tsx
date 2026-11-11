import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchTeacherDashboardData, TeacherDashboardData } from '../../services/dashboardService';
import { StatCard } from '../../components/ui/StatCard';
import {
  CalendarCheck,
  ClipboardList,
  Sparkles,
  Award,
  CheckCircle2,
  FolderSync,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  ChevronRight,
  ChevronDown,
  Layers,
  HelpCircle,
  ExternalLink,
  Search,
  Check,
  Info,
  Heart,
  TrendingUp,
} from 'lucide-react';

interface TeacherDashboardProps {
  onNavigate: (view: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<'bi' | 'ipas'>('bi');
  const [activeModalItem, setActiveModalItem] = useState<{
    title: string;
    type: 'cp' | 'tp' | 'atp' | 'kisi' | 'soal' | 'nilai';
    content: React.ReactNode;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchTeacherDashboardData(user?.teacherId);
        setData(res);
      } catch (err) {
        console.error('Error loading teacher dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Data Perangkat Bahasa Indonesia
  const biCurriculum = {
    cp: [
      {
        element: 'Menyimak',
        desc: 'Peserta didik mampu memahami ide pokok dan pendukung pada teks audio, teks aural (teks yang dibacakan), dan teks audiovisual.',
      },
      {
        element: 'Membaca & Memirsa',
        desc: 'Peserta didik mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi anak dalam bentuk cetak atau elektronik.',
      },
      {
        element: 'Berbicara & Mempresentasikan',
        desc: 'Peserta didik mampu melafalkan kata secara fasih dan menyajikan ungkapan santun menggunakan Kurikulum Berbasis Cinta dalam interaksi antarteman.',
      },
      {
        element: 'Menulis',
        desc: 'Peserta didik mampu menulis teks narasi dan deskripsi dengan tulisan tegak bersambung dan kaidah bahasa Indonesia yang baik.',
      },
    ],
    tp: [
      { code: 'TP 4.1', text: 'Mengidentifikasi ide pokok dari teks cerita rakyat nusantara secara teliti.', semester: 'Ganjil' },
      { code: 'TP 4.2', text: 'Menjelaskan arti kata-kata baru menggunakan Kamus Besar Bahasa Indonesia (KBBI).', semester: 'Ganjil' },
      { code: 'TP 4.3', text: 'Menuliskan paragraf deskripsi sederhana tentang lingkungan madrasah dengan kosakata baku.', semester: 'Ganjil' },
      { code: 'TP 4.4', text: 'Mempresentasikan hasil pengamatan tanaman di madrasah dengan penuh percaya diri.', semester: 'Ganjil' },
      { code: 'TP 4.5', text: 'Membedakan kalimat transitif dan intransitif dalam teks bacaan bertema kasih sayang.', semester: 'Genap' },
    ],
    atp: [
      { stage: 'Tahap 1', bab: 'Bab 1: Sudah Besar', focus: 'Menyimak cerita, kalimat transitif/intransitif, KBBI', jp: '18 JP' },
      { stage: 'Tahap 2', bab: 'Bab 2: Di Bawah Atap', focus: 'Tugas di rumah, kata hubung, teks deskripsi keluarga', jp: '18 JP' },
      { stage: 'Tahap 3', bab: 'Bab 3: Lihat Sekitar', focus: 'Denah rute jalan madrasah, kalimat persuasif, rambu lalu lintas', jp: '18 JP' },
      { stage: 'Tahap 4', bab: 'Bab 4: Meliuk dan Menerjang', focus: 'Teks wawancara sederhana, ide pokok, gaya bahasa', jp: '18 JP' },
    ],
    evaluation: {
      kisi: [
        { code: 'KISI-01', topik: 'Kalimat Transitif & Intransitif', bentuk: 'Pilihan Ganda & Uraian', level: 'L2 (Aplikasi)' },
        { code: 'KISI-02', topik: 'Kosakata Baru & Arti Kata KBBI', bentuk: 'Menjodohkan & Isian', level: 'L1 (Pemahaman)' },
        { code: 'KISI-03', topik: 'Paragraf Deskripsi Madrasah', bentuk: 'Unjuk Kerja / Praktik Tulis', level: 'L3 (Penalaran/HOTS)' },
      ],
      soal: [
        { nomor: 1, soal: 'Perhatikan kalimat: "Farhan membaca buku cerita di perpustakaan madrasah." Kalimat tersebut termasuk jenis kalimat...', tipe: 'PG' },
        { nomor: 2, soal: 'Jelaskan perbedaan kalimat transitif dan kalimat intransitif beserta contohnya masing-masing!', tipe: 'Uraian' },
      ],
      gradesSummary: [
        { name: 'Ahmad Faiz Al-Habsyi', formatif: 88, sts: 90, sas: 87, akhir: 88, status: 'Tuntas' },
        { name: 'Aisyah Putri Rahmawati', formatif: 94, sts: 95, sas: 93, akhir: 94, status: 'Tuntas' },
        { name: 'Bilal Pratama Soborejo', formatif: 72, sts: 70, sas: 74, akhir: 72, status: 'Perlu Remedial' },
      ],
    },
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          BANNER UTAMA: DASHBOR GURU
          ========================================================================= */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-900">
              DASHBOR GURU
            </span>
            <span className="text-xs text-emerald-300 font-medium">
              MI Ma’arif Al Ihsan Soborejo
            </span>
          </div>
          <h2 className="text-xl font-extrabold mt-2 tracking-tight">
            Selamat Bertugas, {data.teacherName}
          </h2>
          <p className="text-xs text-emerald-200 mt-0.5">
            NIP: {data.nip} · Spesialisasi: {data.specialization} · TP 2026/2027 Semester Ganjil
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user?.roles?.includes('wali_kelas') ? (
            <button
              onClick={() => onNavigate('presensi')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-700/80 hover:bg-emerald-600 transition-colors border border-emerald-500/30"
            >
              <CalendarCheck className="w-4 h-4 text-amber-300" />
              <span>Presensi Rombel Binaan</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('jurnal-mengajar')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-700/80 hover:bg-emerald-600 transition-colors border border-emerald-500/30"
            >
              <ClipboardList className="w-4 h-4 text-amber-300" />
              <span>Jurnal Mengajar Hari Ini</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('asisten-ai')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-950" />
            <span>Asisten Gemini</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          1. PRESENSI / JURNAL KBM STRIP
          ========================================================================= */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 shrink-0 mt-0.5">
              {user?.roles?.includes('wali_kelas') ? (
                <CalendarCheck className="w-5 h-5 text-emerald-700" />
              ) : (
                <ClipboardList className="w-5 h-5 text-emerald-700" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  {user?.roles?.includes('wali_kelas')
                    ? 'Presensi Siswa Rombel Binaan'
                    : 'Jurnal Mengajar & Presensi KBM'}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  {user?.roles?.includes('wali_kelas') ? 'Wali Kelas' : 'Guru Pengampu'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {user?.roles?.includes('wali_kelas')
                  ? 'Pencatatan harian kehadiran siswa khusus rombel binaan Anda untuk akumulasi otomatis buku rapor.'
                  : 'Catat keterlaksanaan modul ajar, aktivitas Deep Learning, dan catatan presensi siswa pada jam tatap muka.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {user?.roles?.includes('wali_kelas') ? (
              <button
                onClick={() => onNavigate('presensi')}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Buka Presensi Rombel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('jurnal-mengajar')}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Buka Jurnal Mengajar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. MATA PELAJARAN (STRUKTUR HIERARKIS SESUAI SPESIFIKASI PENGGUNA)
             |---- BAHASA INDONESIA
                     ---- Perangkat Pembelajaran (CP, TP, ATP, dll)
                     ---- Perangkat Evaluasi (Kisi-kisi, Soal, Daftar nilai, dll)
             |---- IPAS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700" />
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                Mata Pelajaran yang Diampu
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola Perangkat Pembelajaran dan Perangkat Evaluasi sesuai Kurikulum Merdeka & Kurikulum Berbasis Cinta
            </p>
          </div>

          {/* Tab Pemilih Mapel */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedSubjectTab('bi')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedSubjectTab === 'bi'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BAHASA INDONESIA
            </button>
            <button
              onClick={() => setSelectedSubjectTab('ipas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedSubjectTab === 'ipas'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              IPAS
            </button>
          </div>
        </div>

        {/* Workspace Mapel Terpilih */}
        {selectedSubjectTab === 'bi' ? (
          <div className="space-y-6">
            {/* Header Mapel */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  Mata Pelajaran Utama · Kelas 4
                </span>
                <h4 className="font-bold text-sm text-emerald-950 mt-1">
                  BAHASA INDONESIA (Fase B)
                </h4>
                <p className="text-xs text-emerald-800">
                  Guru Pengampu: {data.teacherName} · Alokasi: 6 JP/Minggu
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('arsip-drive')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-semibold text-xs hover:bg-emerald-100/50 flex items-center gap-1.5 transition-colors"
                >
                  <FolderSync className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Arsip Dokumen Drive</span>
                </button>
              </div>
            </div>

            {/* Dua Kolom: Perangkat Pembelajaran vs Perangkat Evaluasi */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* =========================================================
                  KOLOM A: PERANGKAT PEMBELAJARAN
                  (CP, TP, ATP, dll)
                  ========================================================= */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Perangkat Pembelajaran
                    </h5>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                    Lengkap & Terstruktur
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* 1. CP */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">CP</span>
                        <span className="text-slate-700 font-medium">Capaian Pembelajaran Fase B</span>
                      </div>
                      <button
                        onClick={() => onNavigate('cp')}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <span>Kelola CP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Menyimak, Membaca-Memirsa, Berbicara, & Menulis berbasis Kurikulum Merdeka.
                    </p>
                  </div>

                  {/* 2. TP */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">TP</span>
                        <span className="text-slate-700 font-medium">Tujuan Pembelajaran Terpetakan</span>
                      </div>
                      <button
                        onClick={() => onNavigate('tp')}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <span>Kelola TP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Target kompetensi peserta didik terintegrasi Kurikulum Berbasis Cinta & Daftar Nilai.
                    </p>
                  </div>

                  {/* 3. ATP */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">ATP</span>
                        <span className="text-slate-700 font-medium">Alur Tujuan Pembelajaran</span>
                      </div>
                      <button
                        onClick={() => onNavigate('atp')}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <span>Kelola ATP</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Urutan sekuensial modul ajar Semester 1 dan 2 (total 72 JP).
                    </p>
                  </div>

                  {/* 4. Modul Ajar & LKPD */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">Modul & LKPD</span>
                        <span className="text-slate-700 font-medium">Deep Learning & Lembar Kerja</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onNavigate('modul-ajar')}
                          className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                        >
                          Modul Ajar
                        </button>
                        <button
                          onClick={() => onNavigate('lkpd')}
                          className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                        >
                          LKPD
                        </button>
                        <button
                          onClick={() => onNavigate('arsip-drive')}
                          className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                        >
                          Drive
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Dokumen pembelajaran mendalam tersimpan aman di Google Drive madrasah.
                    </p>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  KOLOM B: PERANGKAT EVALUASI (PER LINGKUP MATERI & STS/SAS)
                  ========================================================= */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Perangkat Evaluasi (per Lingkup Materi)
                    </h5>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                    KKTP: 75
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* LM 1 & LM 2 */}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 font-mono text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded mr-1.5">
                        LM 1 & LM 2
                      </span>
                      <span className="text-slate-700 font-medium text-xs">Sudah Besar & Di Bawah Atap</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Kisi-kisi & Soal Formatif/Sumatif TP 4.1 s.d. 4.3</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onNavigate('eval-lm1')}
                        className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px]"
                      >
                        LM 1
                      </button>
                      <button
                        onClick={() => onNavigate('eval-lm2')}
                        className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px]"
                      >
                        LM 2
                      </button>
                    </div>
                  </div>

                  {/* KHUSUS: SUMATIF TENGAH SEMESTER (STS) */}
                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-300 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[10px] bg-amber-400 text-slate-900 px-2 py-0.5 rounded">
                          ⭐ STS GANJIL
                        </span>
                        <span className="font-bold text-slate-900 text-xs">Sumatif Tengah Semester</span>
                      </div>
                      <p className="text-[10px] text-amber-900 mt-0.5">Naskah ulangan tengah semester & rekap capaian tengah semester.</p>
                    </div>
                    <button
                      onClick={() => onNavigate('eval-sts')}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs shadow-xs"
                    >
                      Buka STS
                    </button>
                  </div>

                  {/* LM 3 & LM 4 */}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 font-mono text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded mr-1.5">
                        LM 3 & LM 4
                      </span>
                      <span className="text-slate-700 font-medium text-xs">Lihat Sekitar & Meliuk Menerjang</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Kisi-kisi & Soal Formatif/Sumatif TP 4.4 & 4.5</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onNavigate('eval-lm3')}
                        className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px]"
                      >
                        LM 3
                      </button>
                      <button
                        onClick={() => onNavigate('eval-lm4')}
                        className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px]"
                      >
                        LM 4
                      </button>
                    </div>
                  </div>

                  {/* KHUSUS: SUMATIF AKHIR SEMESTER (SAS) */}
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-300 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded">
                          🏆 SAS GANJIL
                        </span>
                        <span className="font-bold text-slate-900 text-xs">Sumatif Akhir Semester</span>
                      </div>
                      <p className="text-[10px] text-emerald-800 mt-0.5">Asesmen komprehensif penentu nilai rapor semester ganjil.</p>
                    </div>
                    <button
                      onClick={() => onNavigate('eval-sas')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
                    >
                      Buka SAS
                    </button>
                  </div>

                  {/* Integrasi Buku Nilai, Remedial & Analisis */}
                  <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <button
                      onClick={() => onNavigate('asesmen-nilai')}
                      className="text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1"
                    >
                      <span>Buku Nilai</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onNavigate('remedial-pengayaan')}
                        className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded"
                      >
                        Remedial
                      </button>
                      <button
                        onClick={() => onNavigate('analisis-nilai')}
                        className="text-[10px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded"
                      >
                        Analisis
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             MATA PELAJARAN: IPAS (KELAS 4)
             ========================================================================= */
          <div className="space-y-6">
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-200 text-sky-900">
                  Mata Pelajaran Pendukung · Kelas 4
                </span>
                <h4 className="font-bold text-sm text-sky-950 mt-1">
                  ILMU PENGETAHUAN ALAM DAN SOSIAL (IPAS)
                </h4>
                <p className="text-xs text-sky-800">
                  Fase B · Alokasi: 5 JP/Minggu · Eksperimen & Lingkungan Madrasah
                </p>
              </div>
              <button
                onClick={() => onNavigate('arsip-drive')}
                className="px-3 py-1.5 rounded-lg bg-white border border-sky-200 text-sky-800 font-semibold text-xs hover:bg-sky-100/50 flex items-center gap-1.5 transition-colors"
              >
                <FolderSync className="w-3.5 h-3.5 text-sky-700" />
                <span>Arsip IPAS Drive</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Perangkat Pembelajaran IPAS */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-sky-600" />
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Perangkat Pembelajaran IPAS
                    </h5>
                  </div>
                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                    Fase B
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">CP IPAS: Bagian Tumbuhan & Wujud Zat</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Menganalisis hubungan bentuk serta fungsi tubuh tumbuhan.</p>
                    </div>
                    <button
                      onClick={() => onNavigate('cp')}
                      className="px-2.5 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[11px]"
                    >
                      Kelola CP
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">TP & ATP: 4 Bab Pembelajaran Semester Ganjil</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tumbuhan Sumber Kehidupan, Wujud Zat & Gaya di Sekitar.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onNavigate('tp')}
                        className="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[10px]"
                      >
                        TP
                      </button>
                      <button
                        onClick={() => onNavigate('atp')}
                        className="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[10px]"
                      >
                        ATP
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Modul Ajar & LKPD Eksperimen Sains</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Praktikum pengamatan lingkungan daun madrasah.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onNavigate('modul-ajar')}
                        className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px]"
                      >
                        Modul
                      </button>
                      <button
                        onClick={() => onNavigate('lkpd')}
                        className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px]"
                      >
                        LKPD
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Perangkat Evaluasi IPAS */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Perangkat Evaluasi IPAS
                    </h5>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    KKTP: 75
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Kisi-kisi & Rubrik Observasi Praktikum</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Kriteria penilaian kinerja saintifik dan proses sains.</p>
                    </div>
                    <button
                      onClick={() => onNavigate('kisi-kisi')}
                      className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px]"
                    >
                      Kisi-kisi
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Bank Soal Formatif & Sumatif IPAS</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Soal kontekstual lingkungan alam sekitar Soborejo.</p>
                    </div>
                    <button
                      onClick={() => onNavigate('soal-asesmen')}
                      className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px]"
                    >
                      Soal
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Daftar Nilai, Remedial & Analisis KKTP</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">28 siswa tercatat tuntas kriteria.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onNavigate('asesmen-nilai')}
                        className="px-2 py-1 rounded bg-emerald-700 text-white font-bold text-[10px]"
                      >
                        Nilai
                      </button>
                      <button
                        onClick={() => onNavigate('remedial-pengayaan')}
                        className="px-2 py-1 rounded bg-amber-100 text-amber-900 font-bold text-[10px]"
                      >
                        Remedial
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. JURNAL MENGAJAR & SUPERVISI (TABEL & EKSPOR CSV / PDF)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Modul Jurnal Mengajar Terstruktur */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-700" />
                <h4 className="font-bold text-sm text-slate-900">Jurnal Mengajar Harian</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Tabel & Ekspor
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Daftar kegiatan tatap muka KBM, capaian materi, Kurikulum Berbasis Cinta, dan refleksi pembelajaran yang dapat diekspor ke Excel/CSV dan PDF.
            </p>

            {/* Cuplikan Jurnal Terakhir */}
            <div className="space-y-2">
              {data.recentJournals.slice(0, 2).map((jrn) => (
                <div key={jrn.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span className="font-bold text-emerald-900">{jrn.className} · {jrn.subjectName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{jrn.date}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 font-medium mt-1 line-clamp-2">
                    {jrn.topic}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => onNavigate('jurnal-mengajar')}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition-colors flex items-center gap-1.5 shadow-xs w-full justify-center"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Buka Tabel Jurnal & Ekspor</span>
            </button>
          </div>
        </div>

        {/* Modul Riwayat Supervisi Akademik Kepala Madrasah */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-sm text-slate-900">Riwayat Supervisi Guru</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                Tabel & Ekspor
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Hasil observasi langsung Kepala Madrasah: skor instrumen, Kurikulum Berbasis Cinta, aspek Deep Learning, dan rencana tindak lanjut.
            </p>

            {/* Ringkasan Skor Supervisi Guru */}
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Supervisi Pelaksanaan KBM Semester Ini</p>
                  <p className="text-[11px] text-slate-600">Supervisor: H. Ahmad Fauzi, S.Pd.I., M.Pd.</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-emerald-800 font-mono">92</span>
                  <p className="text-[10px] font-bold text-emerald-700">Amat Baik</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 italic border-t border-amber-200/60 pt-2">
                "Penguasaan materi sangat prima, suasana kelas hangat penuh cinta, murid sangat aktif dan antusias."
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => onNavigate('supervisi-guru')}
              className="px-3.5 py-2 rounded-lg bg-amber-400 text-slate-900 font-bold text-xs hover:bg-amber-500 transition-colors flex items-center gap-1.5 shadow-xs w-full justify-center"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Buka Tabel Supervisi & Ekspor</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL DETAIL ITEM PERANGKAT (CP / TP / ATP / KISI / SOAL)
          ========================================================================= */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-sm text-slate-900">{activeModalItem.title}</h4>
              <button
                onClick={() => setActiveModalItem(null)}
                className="text-xs text-slate-400 hover:text-slate-700 p-1 font-bold"
              >
                Tutup
              </button>
            </div>

            <div className="py-2">{activeModalItem.content}</div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={() => {
                  setActiveModalItem(null);
                  onNavigate('arsip-drive');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors flex items-center gap-1.5"
              >
                <FolderSync className="w-3.5 h-3.5" />
                <span>Buka Dokumen Google Drive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
