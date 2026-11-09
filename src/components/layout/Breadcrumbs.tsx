import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

interface CrumbItem {
  label: string;
  view?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ activeView, onNavigate }) => {
  const getCrumbs = (): CrumbItem[] => {
    switch (activeView) {
      case 'dashboard':
        return [{ label: 'Beranda Dasbor' }];

      case 'profil':
        return [{ label: 'Pengaturan Akun' }, { label: 'Profil & Keamanan Sandi' }];

      case 'kelola-pengguna':
        return [{ label: 'Tata Kelola Pengguna' }, { label: 'Pengguna & Peran' }];

      case 'master-guru':
        return [{ label: 'Data Master' }, { label: 'Data Guru & Staf' }];

      case 'master-siswa':
      case 'siswa-kelas':
        return [{ label: 'Data Master' }, { label: 'Data Peserta Didik (NISN)' }];

      case 'master-kelas':
        return [{ label: 'Data Master' }, { label: 'Kelas 1 s.d. 6' }];

      case 'master-mapel':
        return [{ label: 'Data Master' }, { label: 'Mata Pelajaran' }];

      case 'penugasan-guru':
      case 'penugasan-rekap':
        return [{ label: 'Data Master' }, { label: 'Penugasan Mengajar Berbasis Rombel' }];

      case 'penugasan-cls-1':
      case 'penugasan-cls-2':
      case 'penugasan-cls-3':
      case 'penugasan-cls-4':
      case 'penugasan-cls-5':
      case 'penugasan-cls-6': {
        const clsNum = activeView.split('-')[2];
        return [
          { label: 'Penugasan Mengajar', view: 'penugasan-guru' },
          { label: `Rombel Kelas ${clsNum}` },
        ];
      }

      case 'pengaturan-akademik':
        return [{ label: 'Data Master' }, { label: 'Tahun Ajaran & KKTP' }];

      case 'pengaturan-identitas':
        return [{ label: 'Data Master' }, { label: 'Konfigurasi Identitas & Logo Madrasah' }];

      case 'migrasi-data':
        return [{ label: 'Data Master' }, { label: 'Pusat Migrasi & Impor Data (Excel)' }];

      case 'lapor-kendala':
        return [{ label: 'Layanan Operasional' }, { label: 'Pusat Evaluasi & Lapor Kendala' }];

      case 'pusat-bantuan':
        return [{ label: 'Layanan Operasional' }, { label: 'Pusat Bantuan & Panduan SIMPEL' }];

      case 'arsip-drive':
        return [{ label: 'Kurikulum' }, { label: 'Arsip Dokumen Google Drive' }];

      case 'cp':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Pembelajaran', view: 'cp' },
          { label: 'Capaian Pembelajaran (CP)' },
        ];

      case 'tp':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Pembelajaran', view: 'cp' },
          { label: 'Tujuan Pembelajaran (TP)' },
        ];

      case 'atp':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Pembelajaran', view: 'cp' },
          { label: 'Alur Tujuan Pembelajaran (ATP)' },
        ];

      case 'modul-ajar':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Pembelajaran', view: 'cp' },
          { label: 'Modul Ajar Deep Learning' },
        ];

      case 'lkpd':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Pembelajaran', view: 'cp' },
          { label: 'Lembar Kerja Peserta Didik (LKPD)' },
        ];

      case 'eval-lm1':
      case 'eval-lm2':
      case 'eval-lm3':
      case 'eval-lm4': {
        const lmCode = activeView.replace('eval-', '').toUpperCase();
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Evaluasi', view: 'eval-lm1' },
          { label: `Lingkup Materi (${lmCode})` },
        ];
      }

      case 'eval-sts':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Evaluasi', view: 'eval-lm1' },
          { label: 'Sumatif Tengah Semester (STS)' },
        ];

      case 'eval-sas':
        return [
          { label: 'Mata Pelajaran (Bahasa Indonesia)', view: 'dashboard' },
          { label: 'Perangkat Evaluasi', view: 'eval-lm1' },
          { label: 'Sumatif Akhir Semester (SAS)' },
        ];

      case 'kisi-kisi':
      case 'soal-asesmen':
      case 'asesmen-nilai':
      case 'remedial-pengayaan':
      case 'analisis-nilai':
        return [
          { label: 'Perangkat Evaluasi', view: 'eval-lm1' },
          { label: activeView.replace('-', ' ').toUpperCase() },
        ];

      case 'presensi':
      case 'rekap-presensi-kelas':
      case 'monitoring-kbm':
        return [{ label: 'Administrasi KBM' }, { label: 'Presensi Siswa Harian' }];

      case 'jurnal-mengajar':
        return [{ label: 'Administrasi KBM' }, { label: 'Jurnal Mengajar Guru' }];

      case 'supervisi-kbm':
      case 'supervisi-guru':
        return [{ label: 'Penjaminan Mutu' }, { label: 'Supervisi Pembelajaran & KBM' }];

      case 'bimbingan-siswa':
        return [{ label: 'Layanan Siswa' }, { label: 'Bimbingan Konseling (BK)' }];

      case 'asisten-ai':
      case 'asisten-ai-modul':
      case 'asisten-ai-lkpd':
      case 'asisten-ai-soal':
      case 'asisten-ai-ide':
      case 'asisten-ai-refleksi':
      case 'asisten-ai-analisis':
      case 'asisten-ai-kamad':
      case 'asisten-ai-chat':
        return [{ label: 'Kecerdasan Buatan' }, { label: 'Asisten AI Gemini Tahap 6' }];

      default:
        return [{ label: activeView.replace('-', ' ') }];
    }
  };

  const crumbs = getCrumbs();

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 overflow-x-auto scrollbar-none py-1">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1 text-slate-600 hover:text-emerald-700 font-medium transition-colors shrink-0"
        title="Kembali ke Beranda"
      >
        <Home className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden sm:inline">Beranda</span>
      </button>

      {crumbs.map((c, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {c.view && !isLast ? (
              <button
                onClick={() => onNavigate(c.view!)}
                className="hover:text-emerald-700 font-medium text-slate-600 transition-colors whitespace-nowrap shrink-0"
              >
                {c.label}
              </button>
            ) : (
              <span
                className={`whitespace-nowrap shrink-0 ${
                  isLast ? 'font-bold text-slate-800' : 'text-slate-500 font-medium'
                }`}
              >
                {c.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
