import React, { useEffect, useState } from 'react';
import { fetchPrincipalDashboardData, PrincipalDashboardData } from '../../services/dashboardService';
import { StatCard } from '../../components/ui/StatCard';
import {
  FolderSync,
  ClipboardList,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Award,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface PrincipalDashboardProps {
  onNavigate: (view: string) => void;
}

export const PrincipalDashboard: React.FC<PrincipalDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchPrincipalDashboardData();
        setData(res);
      } catch (err) {
        console.error('Error loading principal dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Dashboard Supervisi Kepala Madrasah
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengawasan kelengkapan perangkat ajar, pemantauan KBM harian, dan verifikasi penilaian
          </p>
        </div>

        <button
          onClick={() => onNavigate('supervisi-kbm')}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs"
        >
          <Award className="w-4 h-4" />
          <span>Formulir Supervisi KBM</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Supervisi KBM Langsung"
          value="4 Sesi"
          subtitle="Observasi kelas & kurikulum cinta"
          icon={Award}
          badgeText="Formulir"
          badgeType="success"
          onClick={() => onNavigate('supervisi-kbm')}
        />
        <StatCard
          title="Tindak Lanjut Supervisi"
          value="2 Rencana"
          subtitle="Pendampingan tindak lanjut guru"
          icon={CheckCircle2}
          badgeText="Dalam Proses"
          badgeType="info"
          onClick={() => onNavigate('supervisi-kbm')}
        />
        <StatCard
          title="Jurnal Terisi Hari Ini"
          value={data.totalJournalsToday}
          subtitle="Rekap entri KBM dari dewan guru"
          icon={ClipboardList}
          badgeText="KBM Aktif"
          badgeType="info"
          onClick={() => onNavigate('monitoring-kbm')}
        />
        <StatCard
          title="Tingkat Kehadiran Siswa"
          value={`${data.attendanceRateToday}%`}
          subtitle="Rata-rata presensi kelas hari ini"
          icon={CalendarCheck}
          badgeText="Tinggi"
          badgeType="success"
          onClick={() => onNavigate('monitoring-kbm')}
        />
      </div>

      {/* Grid: Dokumen Menunggu Review & Jurnal Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Dokumen Arsip Perangkat Ajar Guru */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-emerald-700" />
                <span>Arsip Dokumen Perangkat Ajar (Google Drive)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengarsipan berkas RPP, Modul Ajar, Prota, dan LKPD guru
              </p>
            </div>
            <button
              onClick={() => onNavigate('arsip-drive')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Lihat Arsip
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data.pendingDocuments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                Seluruh dokumen ajar telah diperiksa. Tidak ada antrean baru.
              </div>
            ) : (
              data.pendingDocuments.map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                        {doc.documentType}
                      </span>
                      <p className="text-xs font-semibold text-slate-900">{doc.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Diajukan oleh: <span className="font-medium text-slate-700">{doc.teacherName}</span> ·{' '}
                      {new Date(doc.submissionDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={doc.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <span>Buka Drive</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                    <button
                      onClick={() => onNavigate('supervisi-drive')}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
                    >
                      Beri Nilai / Catatan
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Kolom 3: Pemantauan Jurnal KBM Hari Ini */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <span>Aktivitas KBM Terkini</span>
              </h3>
              <span className="text-[10px] text-slate-400">Jurnal Masuk</span>
            </div>

            <div className="space-y-3">
              {data.recentJournals.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Belum ada jurnal KBM masuk.</p>
              ) : (
                data.recentJournals.map((jrn) => (
                  <div key={jrn.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span className="text-emerald-900 font-semibold">{jrn.className} · {jrn.subjectName}</span>
                      <span className="text-[10px] text-slate-400">{jrn.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium mt-1 line-clamp-2">
                      {jrn.topic}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Guru: {jrn.teacherName}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-center">
            <button
              onClick={() => onNavigate('monitoring-kbm')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1 w-full"
            >
              <span>Pantau Seluruh KBM Madrasah</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
