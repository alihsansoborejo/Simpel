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
    if (
      activeView.startsWith('penugasan-') &&
      activeView !== 'penugasan-guru' &&
      activeView !== 'penugasan-rekap'
    ) {
      const token = activeView.replace(/^penugasan-/, '');
      let rombelLabel = '';
      try {
        const rawClasses = localStorage.getItem('simpel_classes');
        if (rawClasses) {
          const parsed = JSON.parse(rawClasses) as Array<{ id: string; level?: number; name?: string }>;
          const byId = parsed.find((c) => c.id === token);
          if (byId?.name) {
            rombelLabel = byId.name.toLowerCase().startsWith('rombel') ? byId.name : `Rombel ${byId.name}`;
          } else if (token.startsWith('cls-')) {
            const lvl = parseInt(token.replace('cls-', ''), 10);
            const byLvl = Number.isFinite(lvl) ? parsed.find((c) => c.level === lvl) : undefined;
            if (byLvl?.name) {
              rombelLabel = byLvl.name.toLowerCase().startsWith('rombel') ? byLvl.name : `Rombel ${byLvl.name}`;
            }
          }
        }
      } catch {
        // ignore storage parse error
      }
      if (!rombelLabel && token.startsWith('cls-')) {
        const clsNum = token.replace('cls-', '');
        rombelLabel = `Rombel Kelas ${clsNum}`;
      }
      return [
        { label: 'Penugasan Mengajar', view: 'penugasan-guru' },
        { label: rombelLabel || 'Detail Rombel' },
      ];
    }

    if (activeView.startsWith('eval-scope:')) {
      const scopeCode = activeView.slice('eval-scope:'.length);
      return [
        { label: 'Perangkat Evaluasi', view: 'kisi-kisi' },
        { label: `Lingkup Materi (${scopeCode})` },
      ];
    }

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
        return [{ label: 'Kurikulum' }, { label: 'Arsip & Kirim Dokumen Google Drive' }];

      case 'perangkat-pembelajaran':
        return [{ label: 'Perangkat Pembelajaran' }];

      case 'cp':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
          { label: 'Capaian Pembelajaran (CP)' },
        ];

      case 'tp':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
          { label: 'Tujuan Pembelajaran (TP)' },
        ];

      case 'atp':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
          { label: 'Alur Tujuan Pembelajaran (ATP)' },
        ];

      case 'prota':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
          { label: 'Program Tahunan (Prota)' },
        ];

      case 'promes':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
          { label: 'Program Semester (Promes)' },
        ];

      case 'modul-ajar':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
          { label: 'Modul Ajar Deep Learning' },
        ];

      case 'lkpd':
        return [
          { label: 'Perangkat Pembelajaran', view: 'perangkat-pembelajaran' },
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
        return [{ label: 'Dashboard Wali Kelas', view: 'dashboard' }, { label: 'Presensi Siswa Rombel Binaan' }];

      case 'monitoring-kbm':
        return [{ label: 'Manajerial KBM' }, { label: 'Monitoring Jurnal KBM' }];

      case 'kokurikuler':
        return [{ label: 'Ko Kurikuler' }];

      case 'kokurikuler-perencanaan':
        return [
          { label: 'Ko Kurikuler', view: 'kokurikuler-perencanaan' },
          { label: 'Perencanaan dan Modul' },
        ];

      case 'kokurikuler-bahan-ajar':
        return [
          { label: 'Ko Kurikuler', view: 'kokurikuler-perencanaan' },
          { label: 'Bahan Ajar dan Aktivitas Murid' },
        ];

      case 'kokurikuler-asesmen':
        return [
          { label: 'Ko Kurikuler', view: 'kokurikuler-perencanaan' },
          { label: 'Asesmen dan Refleksi' },
        ];

      case 'kokurikuler-administrasi':
        return [
          { label: 'Ko Kurikuler', view: 'kokurikuler-perencanaan' },
          { label: 'Administrasi dan Pelaporan' },
        ];

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
        return [{ label: 'Kecerdasan Buatan' }, { label: 'Asisten AI Gemini' }];

      default:
        return [{ label: activeView.replace('-', ' ') }];
    }
  };

  const crumbs = getCrumbs();

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 overflow-x-auto scrollbar-none py-1">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1 text-emerald-800 hover:text-amber-700 font-semibold transition-colors shrink-0"
        title="Kembali ke Beranda"
      >
        <Home className="w-3.5 h-3.5 text-emerald-600" />
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
                className="hover:text-amber-700 font-medium text-emerald-800 transition-colors whitespace-nowrap shrink-0"
              >
                {c.label}
              </button>
            ) : (
              <span
                className={`whitespace-nowrap shrink-0 ${
                  isLast ? 'font-bold text-emerald-950' : 'text-slate-500 font-medium'
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
