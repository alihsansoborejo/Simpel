import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
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
  ShieldCheck,
} from 'lucide-react';

interface HomeroomDashboardProps {
  onNavigate: (view: string) => void;
}

export const HomeroomDashboard: React.FC<HomeroomDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<HomeroomDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await fetchHomeroomDashboardData(user?.homeroomClassId, user);
      setData(res);
    } catch (err) {
      console.error('Error loading homeroom dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

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
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm border border-amber-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-emerald-950">
            Wali Kelas Rombel
          </span>
          <h2 className="text-xl font-bold mt-2 text-amber-50">
            Pusat Monitoring {data.className} (Fase {data.phase})
          </h2>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            Wali: {data.homeroomTeacherName} · {data.totalStudents} siswa terdaftar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.classId && (
            <button
              onClick={() => onNavigate('presensi')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-100 bg-emerald-900/70 hover:bg-emerald-800 border border-amber-400/40 transition-colors shadow-xs"
            >
              <CalendarCheck className="w-4 h-4 text-amber-400" />
              <span>Presensi {data.className}</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('perangkat-kelas')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-100 bg-emerald-900/70 hover:bg-emerald-800 border border-amber-400/40 transition-colors shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Perangkat &amp; Anggota Kelas</span>
          </button>
          <button
            onClick={() => onNavigate('pengolahan-rapor')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-300 to-yellow-400 hover:from-amber-400 hover:to-yellow-500 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-emerald-950" />
            <span>Pengolahan Rapor Rombel</span>
          </button>
        </div>
      </div>

      {!data.classId && (
        <div className="flex items-start gap-2.5 p-3.5 text-xs text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Belum Ada Rombel Asuhan Wali Kelas</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Akun Wali Kelas Anda belum dipetakan ke rombel asuhan oleh Admin Madrasah. Presensi siswa dan rekap kelas akan tampil otomatis setelah rombel asuhan ditetapkan.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Peserta Didik Binaan"
          value={data.totalStudents}
          subtitle="Terdaftar resmi di Dapodik/Emis"
          icon={Users}
          badgeText={data.classId ? 'Lengkap' : 'Menunggu'}
          badgeType={data.classId ? 'success' : 'warning'}
          onClick={() => onNavigate('siswa-kelas')}
        />
        <StatCard
          title={data.classId ? `Presensi ${data.className}` : 'Presensi Rombel Binaan'}
          value={`${data.attendanceSummary.attendancePercentage}%`}
          subtitle={`Hadir: ${data.attendanceSummary.hadirCount} · Sakit: ${data.attendanceSummary.sakitCount} · Izin: ${data.attendanceSummary.izinCount} · Alpa: ${data.attendanceSummary.alpaCount}`}
          icon={CalendarCheck}
          badgeText={data.classId ? 'Isi Presensi' : 'Belum Ada Rombel'}
          badgeType={data.classId ? 'success' : 'warning'}
          onClick={() => onNavigate('presensi')}
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
          badgeText="Semester Aktif"
          badgeType="info"
          onClick={() => onNavigate('pengolahan-rapor')}
        />
      </div>

      {/* Matriks Kelengkapan Nilai & Daftar Siswa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Matriks Kelengkapan Penilaian dari Guru Mapel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs">
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
              className="text-xs font-semibold text-emerald-800 hover:text-amber-700 transition-colors"
            >
              Rincian Nilai
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data.gradeCompletenessStatus.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Belum ada mata pelajaran yang ditugaskan pada rombel ini.
              </p>
            ) : (
              data.gradeCompletenessStatus.map((subj, idx) => (
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
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>*Wali kelas tidak mengubah nilai asli guru tanpa berita acara resmi</span>
            <button
              onClick={() => onNavigate('monitoring-nilai-mapel')}
              className="text-emerald-800 hover:text-amber-700 font-semibold hover:underline"
            >
              Lihat Rekap Kelas Lengkap →
            </button>
          </div>
        </div>

        {/* Kolom 3: Perangkat Kelas & Siswa Binaan */}
        <div className="space-y-6">
          {/* Card Perangkat Kelas Binaan */}
          <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Perangkat Kelas Binaan</h3>
              </div>
              <button
                onClick={() => onNavigate('perangkat-kelas')}
                className="text-[11px] font-semibold text-emerald-800 hover:text-amber-700 hover:underline"
              >
                Kelola
              </button>
            </div>

            {data.officials.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-900 space-y-2">
                <p className="leading-relaxed">
                  Belum ada perangkat kelas (Ketua Kelas, Sekretaris, Bendahara, Seksi) yang ditetapkan untuk {data.className}.
                </p>
                <button
                  onClick={() => onNavigate('perangkat-kelas')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 text-[11px] font-bold transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Tetapkan Perangkat Kelas</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {data.officials.slice(0, 6).map((off) => (
                  <div
                    key={off.id}
                    className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                        {off.roleName}
                      </span>
                      <p className="font-semibold text-slate-900 truncate">{off.studentName}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      NIS {off.nis}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => onNavigate('perangkat-kelas')}
                  className="w-full mt-1 py-1.5 text-[11px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-amber-100 rounded-lg border border-emerald-200 transition-colors flex items-center justify-center gap-1"
                >
                  <span>Kelola Struktur Perangkat ({data.officials.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Card Siswa Binaan */}
          <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Siswa {data.className}</h3>
                <button
                  onClick={() => onNavigate('siswa-kelas')}
                  className="text-xs font-semibold text-emerald-800 hover:text-amber-700 hover:underline"
                >
                  {data.students.length} Siswa · Kelola
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.students.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    Belum ada siswa terdaftar di rombel ini.
                  </p>
                ) : (
                  data.students.map((std, i) => (
                    <div
                      key={std.id}
                      className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-5 h-5 rounded-full bg-amber-300 text-emerald-950 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="truncate">
                          <p className="font-semibold text-slate-900 truncate">{std.fullName}</p>
                          <p className="text-[10px] text-slate-500 font-mono-numbers">NIS: {std.nis}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 shrink-0">
                        {std.gender === 'L' ? 'L' : 'P'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4 text-center">
              <button
                onClick={() => onNavigate('pengolahan-rapor')}
                className="text-xs font-semibold text-emerald-800 hover:text-amber-700 flex items-center justify-center gap-1 w-full transition-colors"
              >
                <span>Buka Modul Rapor Siswa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
