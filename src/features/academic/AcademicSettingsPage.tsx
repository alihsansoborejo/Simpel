import React, { useState, useEffect } from 'react';
import { academicService } from '../../services/academicService';
import { AcademicYear, Semester, SystemSettings } from '../../types/database.types';
import { isSupabaseConfigured, supabase, getSupabaseConfigStatus } from '../../lib/supabaseClient';
import { Save, Plus, CheckCircle, Calendar, ShieldCheck, Database, School, Copy, Download, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export const AcademicSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form input untuk Tahun Ajaran Baru
  const [showAddYearModal, setShowAddYearModal] = useState<boolean>(false);
  const [newYearName, setNewYearName] = useState<string>('2027/2028');
  const [newYearStart, setNewYearStart] = useState<string>('2027-07-15');
  const [newYearEnd, setNewYearEnd] = useState<string>('2028-06-25');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [dbCheckState, setDbCheckState] = useState<{
    checking: boolean;
    reachable: boolean;
    hasAuthSession: boolean;
    authEmail: string | null;
    tablesReady: number;
    totalChecked: number;
    errorMessage: string | null;
  }>({
    checking: false,
    reachable: false,
    hasAuthSession: false,
    authEmail: null,
    tablesReady: 0,
    totalChecked: 8,
    errorMessage: null,
  });

  const supabaseStatus = getSupabaseConfigStatus();

  const checkSupabaseConnection = async () => {
    if (!isSupabaseConfigured) {
      setDbCheckState({
        checking: false,
        reachable: false,
        hasAuthSession: false,
        authEmail: null,
        tablesReady: 0,
        totalChecked: 8,
        errorMessage: 'Variabel lingkungan VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY belum diatur pada Secrets.',
      });
      return;
    }

    setDbCheckState((prev) => ({ ...prev, checking: true, errorMessage: null }));
    const tablesToCheck = [
      'system_settings',
      'academic_years',
      'semesters',
      'classes',
      'teachers',
      'students',
      'supervision_records',
      'notifications',
    ];

    try {
      const [{ data: sessionData }, ...results] = await Promise.all([
        supabase.auth.getSession(),
        ...tablesToCheck.map((tbl) => supabase.from(tbl).select('id', { count: 'exact', head: true })),
      ]);
      const sessionUser = sessionData?.session?.user || null;
      const readyCount = results.filter((r) => !r.error || r.error.code !== '42P01').length;
      const firstErr = results.find((r) => r.error)?.error;
      setDbCheckState({
        checking: false,
        reachable: true,
        hasAuthSession: Boolean(sessionUser),
        authEmail: sessionUser?.email || null,
        tablesReady: readyCount,
        totalChecked: tablesToCheck.length,
        errorMessage: firstErr ? `${firstErr.message} (${firstErr.code || 'Error'})` : null,
      });
    } catch (err: any) {
      setDbCheckState({
        checking: false,
        reachable: false,
        hasAuthSession: false,
        authEmail: null,
        tablesReady: 0,
        totalChecked: tablesToCheck.length,
        errorMessage: err?.message || 'Gagal menghubungi endpoint Supabase.',
      });
    }
  };

  const handleCopySql = async () => {
    try {
      const res = await fetch('/full_migration_all_in_one.sql', { cache: 'no-store' });
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setStatusMessage('Skrip SQL migrasi (Tahap 2) berhasil disalin! Buka Supabase SQL Editor dan tekan Paste (Ctrl+V) lalu Run.');
      setTimeout(() => setIsCopied(false), 4000);
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err) {
      console.error('Gagal menyalin SQL:', err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sets, years, sems] = await Promise.all([
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
      ]);
      setSettings(sets);
      setAcademicYears(years);
      setSemesters(sems);
    } catch (err) {
      console.error('Error loading academic data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    void checkSupabaseConnection();
  }, []);

  useRealtimeSync(['simpel_settings', 'simpel_academic_years', 'simpel_semesters'], () => {
    void loadData();
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const updated = await academicService.updateSettings(settings);
      setSettings(updated);
      setStatusMessage('Pengaturan madrasah berhasil disimpan.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan pengaturan:', err);
      setStatusMessage('Terjadi kesalahan saat menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicService.createAcademicYear({
        name: newYearName,
        start_date: newYearStart,
        end_date: newYearEnd,
        is_active: false,
      });
      setShowAddYearModal(false);
      loadData();
    } catch (err) {
      console.error('Gagal menambah tahun pelajaran:', err);
    }
  };

  const handleActivateYear = async (yearId: string) => {
    if (!settings) return;
    try {
      await academicService.updateSettings({ active_academic_year_id: yearId });
      loadData();
    } catch (err) {
      console.error('Gagal mengaktifkan tahun pelajaran:', err);
    }
  };

  const handleActivateSemester = async (semesterId: string) => {
    if (!settings) return;
    try {
      await academicService.updateSettings({ active_semester_id: semesterId });
      loadData();
    } catch (err) {
      console.error('Gagal mengaktifkan semester:', err);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Memuat pengaturan akademik...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan Akademik & Periode Aktif</h1>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi identitas madrasah, penetapan tahun pelajaran berjalan, semester, dan nilai KKTP default.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${
            isSupabaseConfigured
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : 'text-amber-800 bg-amber-50 border-amber-200'
          }`}
        >
          <Database className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-600'}`} />
          <span>
            {isSupabaseConfigured
              ? 'Tersinkronisasi dengan Database PostgreSQL (Supabase)'
              : 'Sinkronisasi Server Real-Time Aktif (Env Supabase Belum Diatur)'}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid 2 Kolom: Identitas Madrasah & Periode Berjalan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Form Pengaturan Pokok */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-100">
            <School className="w-5 h-5 text-emerald-800" />
            <h2 className="text-sm font-bold text-slate-900">Identitas & Kebijakan Kurikulum Madrasah</h2>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Madrasah</label>
                <input
                  type="text"
                  value={settings.school_name}
                  onChange={(e) => setSettings({ ...settings, school_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NSM (Nomor Statistik Madrasah)</label>
                <input
                  type="text"
                  value={settings.nsm}
                  onChange={(e) => setSettings({ ...settings, nsm: e.target.value })}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={settings.npsn}
                  onChange={(e) => setSettings({ ...settings, npsn: e.target.value })}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">KKTP Default Madrasah (Skala 0-100)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={settings.kktp_default}
                  onChange={(e) => setSettings({ ...settings, kktp_default: Number(e.target.value) })}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kepala Madrasah</label>
                <input
                  type="text"
                  value={settings.principal_name}
                  onChange={(e) => setSettings({ ...settings, principal_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NIP Kepala Madrasah</label>
                <input
                  type="text"
                  value={settings.principal_nip}
                  onChange={(e) => setSettings({ ...settings, principal_nip: e.target.value })}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap Madrasah</label>
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                required
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.is_report_card_locked}
                  onChange={(e) => setSettings({ ...settings, is_report_card_locked: e.target.checked })}
                  className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-slate-800">
                  Kunci Perubahan Nilai Rapor (Hanya dapat diubah setelah persetujuan Kepala Madrasah)
                </span>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Kolom 3: Status Periode Aktif & Kontrol Cepat */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-800" />
                <h3 className="text-sm font-bold text-slate-900">Tahun Pelajaran</h3>
              </div>
              <button
                onClick={() => setShowAddYearModal(true)}
                className="p-1 text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                title="Tambah Tahun Pelajaran"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {academicYears.map((ay) => {
                const isActive = settings.active_academic_year_id === ay.id;
                return (
                  <div
                    key={ay.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                      isActive
                        ? 'border-emerald-300 bg-emerald-50/60 font-semibold text-emerald-900'
                        : 'border-slate-100 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-bold">{ay.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {ay.start_date} s.d. {ay.end_date}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="text-[10px] bg-emerald-800 text-white font-bold px-2 py-0.5 rounded">
                        Aktif
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivateYear(ay.id)}
                        className="text-[11px] text-slate-600 hover:text-emerald-800 font-medium underline"
                      >
                        Aktifkan
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-800" />
              <h3 className="text-sm font-bold text-slate-900">Semester Berjalan</h3>
            </div>

            <div className="space-y-2">
              {semesters.map((sem) => {
                const isActive = settings.active_semester_id === sem.id;
                return (
                  <div
                    key={sem.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                      isActive
                        ? 'border-emerald-300 bg-emerald-50/60 font-semibold text-emerald-900'
                        : 'border-slate-100 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-bold">Semester {sem.semester_type}</p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {sem.start_date} s.d. {sem.end_date}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="text-[10px] bg-emerald-800 text-white font-bold px-2 py-0.5 rounded">
                        Berjalan
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivateSemester(sem.id)}
                        className="text-[11px] text-slate-600 hover:text-emerald-800 font-medium underline"
                      >
                        Pilih
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card Status Supabase & Skrip Migrasi SQL */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white rounded-xl border border-emerald-800/60 shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-800/60 gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold text-white">Database Supabase Madrasah</h3>
              </div>
              {isSupabaseConfigured && dbCheckState.reachable && dbCheckState.tablesReady === dbCheckState.totalChecked && !dbCheckState.errorMessage ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                  Terhubung ({dbCheckState.tablesReady}/{dbCheckState.totalChecked} Tabel)
                </span>
              ) : isSupabaseConfigured ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Perlu Cek ({dbCheckState.tablesReady}/{dbCheckState.totalChecked})
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Env Belum Diatur
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-300 uppercase font-semibold block">Status Konfigurasi:</span>
                  {isSupabaseConfigured && (
                    <button
                      type="button"
                      onClick={() => void checkSupabaseConnection()}
                      disabled={dbCheckState.checking}
                      className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 font-semibold"
                    >
                      <RefreshCw className={`w-3 h-3 ${dbCheckState.checking ? 'animate-spin' : ''}`} />
                      <span>Uji Ulang</span>
                    </button>
                  )}
                </div>
                <span className="font-mono text-[11px] text-slate-200 block truncate">
                  {isSupabaseConfigured ? supabaseStatus.url : 'VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY belum disetel'}
                </span>
                {isSupabaseConfigured && (
                  <div className="pt-1 flex items-center justify-between text-[10px]">
                    <span className="text-slate-300">Sesi Auth Supabase:</span>
                    <span className={dbCheckState.hasAuthSession ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
                      {dbCheckState.hasAuthSession
                        ? `Aktif (${dbCheckState.authEmail || 'Authenticated'})`
                        : 'Belum Login JWT (Anonim / RLS Terbatas)'}
                    </span>
                  </div>
                )}
              </div>

              {!isSupabaseConfigured ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Aplikasi saat ini menggunakan <strong>Sinkronisasi Server Real-Time</strong>. Untuk menghubungkan langsung ke Supabase, tambahkan <code className="text-white">VITE_SUPABASE_URL</code> dan <code className="text-white">VITE_SUPABASE_ANON_KEY</code> pada pengaturan <strong>Secrets / Environment Variables</strong> AI Studio lalu restart server.
                  </span>
                </div>
              ) : !dbCheckState.hasAuthSession ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Env Supabase aktif, namun sesi saat ini belum memiliki token Auth Supabase. Pastikan user <code className="text-white">alihsansoborejo@gmail.com</code> sudah dibuat di <strong>Supabase Auth → Users</strong> lalu keluar (Logout) dan login ulang.
                  </span>
                </div>
              ) : dbCheckState.errorMessage ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed">
                  Catatan verifikasi: {dbCheckState.errorMessage}
                </div>
              ) : null}

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Skrip migrasi database lengkap (42 tabel termasuk kolom logo/identitas madrasah, role admin otomatis, RLS, Realtime publication, trigger, dan seed data) telah siap dijalankan pada Supabase SQL Editor.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCopySql}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-xs"
              >
                {isCopied ? <CheckCircle2 className="w-4 h-4 text-amber-300" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? 'Tersalin ke Clipboard!' : 'Salin Skrip SQL Lengkap (1-Klik)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/full_migration_all_in_one.sql"
                  download="full_migration_all_in_one.sql"
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold border border-white/15 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unduh .sql</span>
                </a>

                <a
                  href="https://supabase.com/dashboard/project/pwdhltrxdijsmmrsuheb/sql/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka SQL Editor</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tambah Tahun Ajaran */}
      {showAddYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Tambah Tahun Pelajaran Baru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Daftarkan periode tahun ajaran baru untuk perencanaan rombel dan KBM masa depan.
            </p>

            <form onSubmit={handleAddYear} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Format Nama Tahun</label>
                <input
                  type="text"
                  placeholder="Contoh: 2027/2028"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={newYearStart}
                    onChange={(e) => setNewYearStart(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-mono tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Berakhir</label>
                  <input
                    type="date"
                    value={newYearEnd}
                    onChange={(e) => setNewYearEnd(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-mono tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddYearModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Tambah Tahun Ajaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
