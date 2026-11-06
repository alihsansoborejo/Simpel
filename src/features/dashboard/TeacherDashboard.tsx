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
} from 'lucide-react';

interface TeacherDashboardProps {
  onNavigate: (view: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400 text-slate-900">
            Guru Pendidik
          </span>
          <h2 className="text-xl font-bold mt-2">
            Selamat Bertugas, {data.teacherName}
          </h2>
          <p className="text-xs text-emerald-200 mt-0.5">
            NIP: {data.nip} · Bidang: {data.specialization} · Mengampu {data.assignedClassesCount} rombel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('asisten-ai')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-950" />
            <span>Asisten AI Gemini</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Rombongan Belajar"
          value={data.assignedClassesCount}
          subtitle={`${data.totalSubjectsTaught} mata pelajaran diampu`}
          icon={BookOpen}
          badgeText="Aktif"
          badgeType="success"
        />
        <StatCard
          title="Jurnal Terisi"
          value={data.journalsCount}
          subtitle="Entri kegiatan belajar semester ini"
          icon={ClipboardList}
          badgeText="KBM"
          badgeType="info"
          onClick={() => onNavigate('jurnal-mengajar')}
        />
        <StatCard
          title="Dokumen Disetujui"
          value={data.approvedDocsCount}
          subtitle={`${data.submittedDocsCount} total dokumen diajukan`}
          icon={CheckCircle2}
          badgeText="Supervisi"
          badgeType="success"
          onClick={() => onNavigate('arsip-drive')}
        />
        <StatCard
          title="Perlu Revisi"
          value={data.revisionDocsCount}
          subtitle="Catatan dari Kepala Madrasah"
          icon={AlertTriangle}
          badgeText={data.revisionDocsCount > 0 ? 'Perlu Edit' : 'Aman'}
          badgeType={data.revisionDocsCount > 0 ? 'warning' : 'neutral'}
          onClick={() => onNavigate('arsip-drive')}
        />
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('presensi')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs text-left transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 w-fit group-hover:bg-emerald-800 group-hover:text-white transition-colors">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 mt-3">Presensi Siswa Hari Ini</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Input kehadiran kelas dengan satu klik "Semua Hadir"</p>
        </button>

        <button
          onClick={() => onNavigate('jurnal-mengajar')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs text-left transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 w-fit group-hover:bg-emerald-800 group-hover:text-white transition-colors">
            <ClipboardList className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 mt-3">Isi Jurnal Mengajar</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Catat topik, KBM mendalam, refleksi, dan tindak lanjut</p>
        </button>

        <button
          onClick={() => onNavigate('asesmen-nilai')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-xs text-left transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 w-fit group-hover:bg-emerald-800 group-hover:text-white transition-colors">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 mt-3">Input Nilai & Asesmen</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Tabel praktis nilai formatif, sumatif, dan remedial</p>
        </button>

        <button
          onClick={() => onNavigate('asisten-ai')}
          className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-emerald-50 border border-amber-200 hover:border-amber-400 hover:shadow-xs text-left transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-amber-400 text-slate-900 w-fit shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 mt-3">Asisten RPP & Modul AI</h3>
          <p className="text-[11px] text-slate-600 mt-0.5">Susun TP, ATP, LKPD, dan kisi-kisi berbasis Gemini</p>
        </button>
      </div>

      {/* Grid: Penugasan Mengajar & Jurnal Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Daftar Kelas yang Diampu */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Penugasan Mengajar Semester Ini</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Surat Keputusan Pembagian Tugas Akademik TA 2026/2027
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">
              {data.assignedClasses.length} Penugasan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.assignedClasses.map((item) => (
              <div
                key={item.assignmentId}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Fase {item.phase}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{item.className}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{item.subjectName}</p>
                  <p className="text-[11px] text-slate-500">Kode: {item.subjectCode}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <button
                    onClick={() => onNavigate('presensi')}
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    Presensi
                  </button>
                  <button
                    onClick={() => onNavigate('asesmen-nilai')}
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    Nilai
                  </button>
                  <button
                    onClick={() => onNavigate('jurnal-mengajar')}
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    Jurnal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom 3: Riwayat Jurnal Terakhir */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Jurnal KBM Terakhir</h3>
              <button
                onClick={() => onNavigate('jurnal-mengajar')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Riwayat
              </button>
            </div>

            <div className="space-y-3">
              {data.recentJournals.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Belum ada jurnal KBM.</p>
              ) : (
                data.recentJournals.map((jrn) => (
                  <div key={jrn.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span className="font-semibold text-emerald-900">{jrn.className} · {jrn.subjectName}</span>
                      <span className="text-[10px] text-slate-400">{jrn.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium mt-1 line-clamp-2">
                      {jrn.topic}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-center">
            <button
              onClick={() => onNavigate('jurnal-mengajar')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1 w-full"
            >
              <span>Tulis Jurnal Baru</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
