import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Users,
  Award,
  Sparkles,
  Search,
  CheckCircle2,
  HelpCircle,
  FolderSync,
  ClipboardList,
  CalendarCheck,
  School,
  FileSpreadsheet,
} from 'lucide-react';

export const HelpCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'guru' | 'kamad' | 'wali' | 'admin' | 'kbc'>('guru');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-800" />
          <span>Pusat Bantuan & Panduan Operasional SIMPEL</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Buku pedoman resmi alur kerja Guru, Kepala Madrasah, Wali Kelas, dan Administrator MI Ma’arif Al Ihsan Soborejo (Tahap 8).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'guru', label: 'Panduan Guru', icon: GraduationCap },
          { id: 'kamad', label: 'Panduan Kepala Madrasah', icon: Award },
          { id: 'wali', label: 'Panduan Wali Kelas', icon: Users },
          { id: 'admin', label: 'Panduan Administrator', icon: School },
          { id: 'kbc', label: 'Kurikulum Berbasis Cinta (KBC)', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content based on Active Tab */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs text-slate-700 leading-relaxed">
        {activeTab === 'guru' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-800" />
                <span>Pedoman Operasional Dewan Guru</span>
              </h2>
              <p className="text-slate-500">
                Langkah-langkah terstruktur bagi Guru Mata Pelajaran dalam menjalankan KBM harian, perencanaan perangkat, dan evaluasi hasil belajar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white text-[11px] flex items-center justify-center font-mono">1</span>
                  <span>Presensi Siswa Harian</span>
                </div>
                <p className="text-slate-600">
                  Pilih tanggal KBM dan kelas binaan. Tandai status kehadiran Hadir (H), Sakit (S), Izin (I), atau Alpa (A). Klik tombol "Simpan Presensi Harian".
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white text-[11px] flex items-center justify-center font-mono">2</span>
                  <span>Jurnal Mengajar Guru</span>
                </div>
                <p className="text-slate-600">
                  Catat materi pokok yang diajarkan, nilai cinta yang ditanamkan (KBC), hambatan belajar santri, dan tindak lanjut perbaikan. Tersedia ekspor ke format Excel.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white text-[11px] flex items-center justify-center font-mono">3</span>
                  <span>Perangkat Pembelajaran & Google Drive</span>
                </div>
                <p className="text-slate-600">
                  Buka menu mapel di sidebar &rarr; Perangkat Pembelajaran (CP, TP, ATP, Modul Ajar, LKPD). Pastikan tautan Google Drive institusi disetel dengan hak melihat.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white text-[11px] flex items-center justify-center font-mono">4</span>
                  <span>Penilaian Lingkup Materi (LM) & STS / SAS</span>
                </div>
                <p className="text-slate-600">
                  Input nilai formatif/sumatif per Lingkup Materi (LM 1 s.d. LM 4) serta Sumatif Tengah Semester (STS) dan Sumatif Akhir Semester (SAS). Sistem otomatis menghitung ketuntasan terhadap KKTP.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kamad' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-800" />
                <span>Pedoman Operasional Kepala Madrasah (Manajerial)</span>
              </h2>
              <p className="text-slate-500">
                Panduan supervisi akademik, monitoring KBM, penelaahan dokumen kurikulum, dan pengesahan rapor madrasah.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">1. Telaah dan Persetujuan Dokumen Kurikulum</h4>
                <p className="text-slate-600">
                  Masuk ke menu <em>Telaah Dokumen Kurikulum</em>. Periksa berkas Google Drive guru pengampu. Tentukan keputusan telaah (Disetujui atau Perlu Revisi) dan berikan catatan bimbingan profesional.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">2. Pelaksanaan Supervisi Akademik & KBM</h4>
                <p className="text-slate-600">
                  Buka menu <em>Supervisi Akademik & KBM</em>. Masukkan skor instrumen observasi kelas, catatan kekuatan guru, dan rencana tindak lanjut pembinaan. Hasil supervisi dapat diekspor ke PDF/Excel.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">3. AI Asisten Kepala Madrasah</h4>
                <p className="text-slate-600">
                  Manfaatkan AI Asisten Kamad untuk merumuskan sambutan resmi, telaah kurikulum madrasah, rekomendasi pembinaan guru, serta analisis mutu capaian madrasah berbasis Kurikulum Merdeka.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wali' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-800" />
                <span>Pedoman Operasional Wali Kelas</span>
              </h2>
              <p className="text-slate-500">
                Panduan kompilasi nilai kelas binaan, pemantauan kehadiran santri bulanan, bimbingan konseling, dan catatan deskripsi rapor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">Monitoring Nilai Seluruh Mapel</h4>
                <p className="text-slate-600">
                  Wali kelas dapat memantau ketercapaian nilai santri pada semua mata pelajaran umum maupun muatan lokal untuk mendeteksi santri yang membutuhkan remedial dini.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">Rekapitulasi Kehadiran Bulanan</h4>
                <p className="text-slate-600">
                  Rekap bulanan terakumulasi otomatis dari presensi harian seluruh guru pengampu sehingga wali kelas tidak perlu merekap secara manual saat pembagian rapor.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-800" />
                <span>Pedoman Administrator Sistem Madrasah</span>
              </h2>
              <p className="text-slate-500">
                Panduan pengelolaan data induk, migrasi massal, penetapan penugasan berbasis rombel, audit sistem, dan penanganan kendala.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">1. Konfigurasi Identitas & Branding</h4>
                <p className="text-slate-600">
                  Perbarui profil institusi, nama kepala madrasah, logo, dan favicon melalui menu <em>Konfigurasi Identitas</em>. Pengaturan otomatis tersimpan ke database tanpa perlu modifikasi kode program.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">2. Penugasan Mengajar Berbasis Rombel</h4>
                <p className="text-slate-600">
                  Buka menu <em>Penugasan Mengajar (SK)</em>. Pilih rombel kelas 1 s.d. 6. Pilih ustadz/ustadzah pengampu setiap mata pelajaran melalui dropdown yang tersedia.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <h4 className="font-bold text-slate-900">3. Migrasi & Impor Data Massal</h4>
                <p className="text-slate-600">
                  Gunakan menu <em>Pusat Migrasi Data</em>. Unduh template resmi, unggah berkas CSV santri/guru, periksa validitas baris pada pratinjau, dan konfirmasi simpan ke database.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kbc' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Prinsip Kurikulum Berbasis Cinta (KBC) & Pembelajaran Mendalam</span>
              </h2>
              <p className="text-slate-500">
                Filosofi pendidikan khas MI Ma’arif Al Ihsan Soborejo yang mengintegrasikan kecerdasan intelektual, kematangan emosional, dan keluhuran akhlak Ahlussunnah wal Jama'ah.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
                <h4 className="font-bold text-emerald-950">1. Cinta kepada Allah & Rasul</h4>
                <p className="text-[11px] text-emerald-800">
                  Setiap materi pembelajaran dikaitkan dengan ketauhidan, rasa syukur atas penciptaan, dan keteladanan akhlak Nabi Muhammad SAW.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
                <h4 className="font-bold text-amber-950">2. Cinta Ilmu & Pembelajaran</h4>
                <p className="text-[11px] text-amber-800">
                  Mendorong santri berpikir kritis, meneliti fenomena alam, dan gemar membaca melalui metode <em>Deep Learning</em> (Mindful, Meaningful, Joyful).
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 space-y-1">
                <h4 className="font-bold text-rose-950">3. Cinta Sesama & Lingkungan</h4>
                <p className="text-[11px] text-rose-800">
                  Membiasakan empati, kerja sama kelompok, kepedulian terhadap teman sebaya, serta menjaga kebersihan dan kelestarian alam madrasah.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
