import React, { useEffect, useState } from 'react';
import { fetchAdminDashboardData, AdminDashboardData } from '../../services/dashboardService';
import { fetchRecentActivityLogs } from '../../services/userService';
import { ActivityLog } from '../../types/database.types';
import { StatCard } from '../../components/ui/StatCard';
import {
  Users,
  GraduationCap,
  School,
  Calendar,
  Lock,
  Unlock,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  Settings,
  Plus,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (view: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashData, logData] = await Promise.all([
          fetchAdminDashboardData(),
          fetchRecentActivityLogs(6),
        ]);
        setData(dashData);
        setLogs(logData);
      } catch (err) {
        console.error('Error loading admin dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-1/4" />
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
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Pusat Kendali Administrator
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Monitoring data pokok madrasah, status periode akademik, dan integritas sistem
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('kelola-pengguna')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Info Status Madrasah Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-700/60 border border-emerald-600">
            <School className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold">{data.schoolName}</h3>
            <p className="text-xs text-emerald-200">
              Kepala: {data.principalName} · Aktif: TA {data.academicYearName} ({data.semesterName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-700/80 font-medium text-emerald-100 flex items-center gap-1.5 border border-emerald-600">
            {data.isReportCardLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Rapor Dikunci</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-300" />
                <span>Rapor Terbuka</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Akun Pengguna"
          value={data.totalUsers}
          subtitle={`${data.activeAccountsCount} akun berstatus aktif`}
          icon={Users}
          badgeText="Sistem"
          badgeType="info"
          onClick={() => onNavigate('kelola-pengguna')}
        />
        <StatCard
          title="Tenaga Pendidik"
          value={data.totalTeachers}
          subtitle="Guru kelas & mapel aktif"
          icon={GraduationCap}
          badgeText="Terdaftar"
          badgeType="success"
          onClick={() => onNavigate('master-guru')}
        />
        <StatCard
          title="Peserta Didik"
          value={data.totalStudents}
          subtitle="Siswa terdaftar di kelas 1-6"
          icon={UserCheck}
          badgeText="Valid NISN"
          badgeType="neutral"
          onClick={() => onNavigate('master-siswa')}
        />
        <StatCard
          title="Rombongan Belajar"
          value={data.totalClasses}
          subtitle="Fase A, Fase B, dan Fase C"
          icon={Calendar}
          badgeText="Lengkap"
          badgeType="success"
          onClick={() => onNavigate('master-kelas')}
        />
      </div>

      {/* Grid: Akses Cepat & Log Aktivitas Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Menu Cepat Administrasi */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-700" />
              <span>Akses Cepat Pengelolaan Data Master</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <button
                onClick={() => onNavigate('kelola-pengguna')}
                className="p-3.5 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-colors flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">Kelola Akun & Hak Akses</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Tambah guru, reset sandi, tetapkan multi-peran wali kelas
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
              </button>

              <button
                onClick={() => onNavigate('master-siswa')}
                className="p-3.5 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-colors flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">Manajemen Peserta Didik</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Data induk siswa, validasi NISN, dan plotting anggota kelas
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
              </button>

              <button
                onClick={() => onNavigate('master-guru')}
                className="p-3.5 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-colors flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">Penugasan Mengajar Guru</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Mapping guru ke rombel dan mata pelajaran per semester
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
              </button>

              <button
                onClick={() => onNavigate('pengaturan-akademik')}
                className="p-3.5 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-colors flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">Pengaturan Tahun Ajaran</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Buka/tutup semester, atur KKTP madrasah, dan kunci rapor
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Kolom 3: Log Aktivitas Sensitif */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Audit & Aktivitas Terbaru</span>
              </h3>
              <span className="text-[10px] text-slate-400">Real-time</span>
            </div>

            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Belum ada catatan aktivitas.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="text-xs border-b border-slate-100 pb-2.5 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {log.profile?.full_name || 'Pengguna'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono-numbers">
                        {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded text-[10px] mr-1">
                        {log.action_name}
                      </span>
                      {log.entity_name}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-center">
            <button
              onClick={() => onNavigate('log-aktivitas')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Lihat Seluruh Riwayat Audit →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
