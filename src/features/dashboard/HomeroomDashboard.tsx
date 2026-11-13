import React, { useEffect, useState } from 'react';
import { fetchHomeroomDashboardData, HomeroomDashboardData } from '../../services/dashboardService';
import { StatCard } from '../../components/ui/StatCard';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Users,
  CalendarCheck,
  Award,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Printer,
  Sparkles,
} from 'lucide-react';

interface HomeroomDashboardProps {
  onNavigate: (view: string) => void;
}

export const HomeroomDashboard: React.FC<HomeroomDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<HomeroomDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await fetchHomeroomDashboardData();
      setData(res);
    } catch (err) {
      console.error('Error loading homeroom dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useRealtimeSync('*', () => {
    void loadData();
  });

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

  const completedMapelCount = data.gradeCompletenessStatus.filter((s) => s.isComplete).length;
  const totalMapelCount = data.gradeCompletenessStatus.length;

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400 text-slate-900">
            Wali Kelas Rombel
          </span>
          <h2 className="text-xl font-bold mt-2">
            Pusat Monitoring {data.className} (Fase {data.phase})
          </h2>
          <p className="text-xs text-emerald-200 mt-0.5">
            Wali: {data.homeroomTeacherName} · {data.totalStudents} siswa terdaftar
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('pengolahan-rapor')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-emerald-950" />
            <span>Pengolahan Rapor Rombel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Peserta Didik Binaan"
          value={data.totalStudents}
          subtitle="Terdaftar resmi di Dapodik/Emis"
          icon={Users}
          badgeText="Lengkap"
          badgeType="success"
          onClick={() => onNavigate('siswa-kelas')}
        />
        <StatCard
          title="Kehadiran Kelas"
          value={`${data.attendanceSummary.attendancePercentage}%`}
          subtitle={`Sakit: ${data.attendanceSummary.sakitCount} · Izin: ${data.attendanceSummary.izinCount} · Alpa: ${data.attendanceSummary.alpaCount}`}
          icon={CalendarCheck}
          badgeText="Sangat Baik"
          badgeType="success"
          onClick={() => onNavigate('rekap-presensi-kelas')}
        />
        <StatCard
          title="Kelengkapan Nilai Mapel"
          value={`${completedMapelCount} / ${totalMapelCount}`}
          subtitle="Mata pelajaran telah dinilai tuntas"
          icon={Award}
          badgeText={completedMapelCount === totalMapelCount ? 'Lengkap' : 'Menunggu Input'}
          badgeType={completedMapelCount === totalMapelCount ? 'success' : 'warning'}
          onClick={() => onNavigate('monitoring-nilai-mapel')}
        />
        <StatCard
          title="Status Kesiapan Rapor"
          value={completedMapelCount === totalMapelCount ? 'Siap Cetak' : 'Draf Olahan'}
          subtitle="Validasi deskripsi capaian TP"
          icon={FileSpreadsheet}
          badgeText="Semester Ganjil"
          badgeType="info"
          onClick={() => onNavigate('pengolahan-rapor')}
        />
      </div>

      {/* Matriks Kelengkapan Nilai & Daftar Siswa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Matriks Kelengkapan Penilaian dari Guru Mapel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Matriks Pemantauan Nilai Guru Mata Pelajaran
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nilai dihimpun langsung dari formulir asesmen guru mata pelajaran terkait
              </p>
            </div>
            <button
              onClick={() => onNavigate('monitoring-nilai-mapel')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Rincian Nilai
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data.gradeCompletenessStatus.map((subj, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{subj.subjectName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pengampu: {subj.teacherName}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono-numbers text-slate-600 text-[11px]">
                    {subj.gradedStudentsCount}/{subj.totalStudents} siswa
                  </span>
                  {subj.isComplete ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Lengkap</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Belum Tuntas</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>*Wali kelas tidak mengubah nilai asli guru tanpa berita acara resmi</span>
            <button
              onClick={() => onNavigate('monitoring-nilai-mapel')}
              className="text-emerald-700 font-semibold hover:underline"
            >
              Lihat Rekap Kelas Lengkap →
            </button>
          </div>
        </div>

        {/* Kolom 3: Siswa Binaan Kelas */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Siswa {data.className}</h3>
              <span className="text-xs font-semibold text-emerald-700">{data.students.length} Siswa</span>
            </div>

            <div className="space-y-2">
              {data.students.map((std, i) => (
                <div
                  key={std.id}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{std.fullName}</p>
                      <p className="text-[10px] text-slate-500 font-mono-numbers">NIS: {std.nis}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">
                    {std.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-center">
            <button
              onClick={() => onNavigate('pengolahan-rapor')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1 w-full"
            >
              <span>Buka Modul Rapor Siswa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
