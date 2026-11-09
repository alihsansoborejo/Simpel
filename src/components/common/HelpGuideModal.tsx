import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Sparkles,
  Award,
  Users,
  ShieldCheck,
  FolderSync,
  Heart,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

export const HelpGuideModal: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'guru' | 'kamad' | 'wali' | 'admin' | 'kbc'>('guru');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-800 text-amber-300">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>Buku Panduan Penggunaan SIMPEL MI AL IHSAN</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  v2.1 Production
                </span>
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Petunjuk praktis pengoperasian aplikasi bagi Guru, Kepala Madrasah, Wali Kelas, dan Admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex overflow-x-auto gap-1 p-2 bg-slate-50 border-b border-slate-200 shrink-0 text-xs font-semibold">
          {[
            { id: 'guru', label: 'Panduan Guru', icon: BookOpen },
            { id: 'kamad', label: 'Panduan Kepala Madrasah', icon: Award },
            { id: 'wali', label: 'Panduan Wali Kelas', icon: Users },
            { id: 'admin', label: 'Panduan Admin', icon: ShieldCheck },
            { id: 'kbc', label: 'Kurikulum Berbasis Cinta (KBC)', icon: Heart },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-800 leading-relaxed">
          {activeTab === 'guru' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <h4 className="font-bold text-emerald-900 text-sm mb-1">Alur Kerja Harian Guru</h4>
                <p className="text-slate-600 text-[11px]">
                  Guru pengampu memiliki hak akses mengelola presensi harian siswa, penyusunan perangkat pembelajaran (CP, TP, ATP, Modul Ajar, LKPD), asesmen penilaian per Lingkup Materi, dan jurnal mengajar.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">1</span>
                    <span>Presensi Siswa Harian</span>
                  </span>
                  <p className="text-slate-600 pl-6.5 text-[11px]">
                    Buka menu <b>Presensi Siswa Harian</b> di bilah sisi. Pilih tanggal dan tandai status kehadiran (Hadir, Sakit, Izin, Alpa) lalu klik <b>Simpan Rekap Presensi</b>.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">2</span>
                    <span>Perangkat Pembelajaran & Asisten AI</span>
                  </span>
                  <p className="text-slate-600 pl-6.5 text-[11px]">
                    Di sub-menu mapel (misal: Bahasa Indonesia / IPAS), kelola CP, TP, ATP, Modul Ajar, dan LKPD. Anda dapat menekan tombol <b>Buat dengan AI</b> untuk merumuskan rancangan otomatis dengan pendekatan Pembelajaran Mendalam (Deep Learning).
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">3</span>
                    <span>Jurnal Mengajar Guru</span>
                  </span>
                  <p className="text-slate-600 pl-6.5 text-[11px]">
                    Setiap selesai KBM, isi topik, capaian, dan kendala kelas di menu <b>Jurnal Mengajar</b>. Data tersimpan rapi dalam format tabel dan dapat diekspor ke Excel / CSV kapan saja.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">4</span>
                    <span>Perangkat Evaluasi per Lingkup Materi & STS/SAS</span>
                  </span>
                  <p className="text-slate-600 pl-6.5 text-[11px]">
                    Kelola Kisi-kisi, Butir Soal, Buku Nilai, Remedial, dan Analisis Belajar per Lingkup Materi (LM 1 s.d. LM 4) serta modul Sumatif Tengah Semester dan Sumatif Akhir Semester.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kamad' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200">
                <h4 className="font-bold text-purple-900 text-sm mb-1">Peran Manajerial Kepala Madrasah</h4>
                <p className="text-slate-600 text-[11px]">
                  Kepala Madrasah memiliki kewenangan supervisi akademik KBM, pemantauan kelengkapan administrasi guru, telaah berkas kurikulum, pengawasan nilai, pengesahan rapor, serta AI Asisten Eksekutif.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Supervisi Akademik & KBM:</b>
                  <p className="text-slate-600 text-[11px]">
                    Buka menu <b>Supervisi Akademik</b> untuk melakukan observasi pembelajaran di kelas. Nilai 4 aspek utama (perencanaan, pelaksanaan, asesmen, pendekatan KBC), berikan catatan tindak lanjut, dan simpan atau ekspor hasil supervisi.
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Telaah Dokumen Google Drive:</b>
                  <p className="text-slate-600 text-[11px]">
                    Periksa draf perangkat ajar yang diajukan guru di menu <b>Telaah Dokumen Kurikulum</b>. Tentukan keputusan: Disetujui atau Perlu Revisi disertai catatan pembinaan.
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">AI Asisten Kepala Madrasah:</b>
                  <p className="text-slate-600 text-[11px]">
                    Manfaatkan AI Gemini di tab <b>Asisten Kepala Madrasah</b> untuk merangkum kondisi mutu madrasah, menganalisis tren presensi siswa, dan membuat materi arahan rapat dewan guru otomatis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wali' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <h4 className="font-bold text-amber-900 text-sm mb-1">Tugas Pokok Wali Kelas</h4>
                <p className="text-slate-600 text-[11px]">
                  Wali Kelas mengawal perkembangan peserta didik di rombel binaannya, merekap absensi bulanan, memantau nilai seluruh mata pelajaran, mencatat karakter, dan mengolah rapor.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Daftar Siswa & Rekap Presensi Rombel:</b>
                  <p className="text-slate-600 text-[11px]">
                    Pantau rekapitulasi kehadiran seluruh murid kelas Anda, periksa siswa yang memiliki catatan sakit atau alpa untuk pembinaan lebih lanjut.
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Monitoring Nilai & Analisis AI:</b>
                  <p className="text-slate-600 text-[11px]">
                    Gunakan fitur <b>AI Analisis Hasil Belajar</b> untuk melihat persentase ketuntasan KKTP dan rekomendasi narasi capaian belajar siswa untuk penulisan buku rapor.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <h4 className="font-bold text-rose-900 text-sm mb-1">Kewenangan Administrator Sistem</h4>
                <p className="text-slate-600 text-[11px]">
                  Admin bertanggung jawab atas integritas basis data master, manajemen pengguna & peran, konfigurasi tahun ajaran, penugasan mengajar SK per rombel, dan audit keamanan.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Penugasan Mengajar Berbasis Rombel:</b>
                  <p className="text-slate-600 text-[11px]">
                    Di menu <b>Penugasan Mengajar (SK)</b>, pilih rombel kelas 1 s.d. 6. Pilih guru pengampu untuk setiap mata pelajaran melalui drop-down.
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Kelola Pengguna & Hak Akses:</b>
                  <p className="text-slate-600 text-[11px]">
                    Menambah, mengedit, atau menonaktifkan akun guru dan staf. Pengguna yang dinonaktifkan tidak dapat login ke dalam sistem.
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <b className="text-slate-900 block">Migrasi & Backup Database:</b>
                  <p className="text-slate-600 text-[11px]">
                    Skrip migrasi SQL lengkap tersedia di menu <b>Tahun Ajaran & KKTP</b> atau berkas <code>public/full_migration_all_in_one.sql</code> untuk dieksekusi di Supabase SQL Editor.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kbc' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <h4 className="font-bold text-emerald-900 text-sm mb-1 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span>Filosofi Kurikulum Berbasis Cinta (KBC)</span>
                </h4>
                <p className="text-slate-600 text-[11px]">
                  Ruh pembelajaran di MI Ma’arif Al Ihsan Soborejo memadukan Kurikulum Merdeka Kemenag dengan kelembutan kasih sayang dan keteladanan Ahlussunnah wal Jama'ah An-Nahdliyyah.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-emerald-200 bg-white">
                  <b className="text-emerald-900 block mb-0.5">1. Kasih Sayang (*Mahabbah*)</b>
                  <p className="text-slate-600 text-[11px]">
                    Membangun iklim kelas yang aman, bebas perundungan, dan menghargai perasaan murid.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-white">
                  <b className="text-emerald-900 block mb-0.5">2. Keteladanan (*Uswatun Hasanah*)</b>
                  <p className="text-slate-600 text-[11px]">
                    Guru menjadi contoh utama dalam adab, kedisiplinan beribadah, dan tutur kata santun.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-white">
                  <b className="text-emerald-900 block mb-0.5">3. Keberagaman (*Tasamuh*)</b>
                  <p className="text-slate-600 text-[11px]">
                    Menerima perbedaan kecepatan belajar murid secara inklusif melalui pembelajaran berdiferensiasi.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-white">
                  <b className="text-emerald-900 block mb-0.5">4. Adab Sebelum Ilmu</b>
                  <p className="text-slate-600 text-[11px]">
                    Mengutamakan pembentukan akhlak mulia dan hormat kepada sesama sebelum capaian angka kognitif.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Butuh bantuan lebih lanjut? Hubungi Admin MI Ma’arif Al Ihsan Soborejo.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
