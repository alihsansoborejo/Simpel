import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { AcademicYear, Semester, SystemSettings } from '../../types/database.types';
import {
  isSupabaseConfigured,
  supabase,
  getSupabaseConfigStatus,
  detectSupabaseQuotaError,
  reportSupabaseOutcome,
  resetSupabaseCircuitBreaker,
  isSupabaseBypassed,
  setSupabaseBypassed,
} from '../../lib/supabaseClient';
import {
  Save,
  Plus,
  CheckCircle,
  Calendar,
  ShieldCheck,
  Database,
  School,
  Copy,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  KeyRound,
  Upload,
  Power,
  HardDrive,
} from 'lucide-react';
import { useRealtimeSync, notifyDomFormSaved } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { signInSupabaseStrict } from '../../services/authService';
import { syncService, isSyncedKey } from '../../services/syncService';

export const AcademicSettingsPage: React.FC = () => {
  const { logout, refreshProfile } = useAuth();
  const { supabaseStatus: liveSupabaseStatus } = useSync();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(() => isSupabaseBypassed());
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const isSettingsDirtyRef = useRef<boolean>(false);

  // Form input untuk Tahun Ajaran Baru
  const [showAddYearModal, setShowAddYearModal] = useState<boolean>(false);
  const [newYearName, setNewYearName] = useState<string>('2027/2028');
  const [newYearStart, setNewYearStart] = useState<string>('2027-07-15');
  const [newYearEnd, setNewYearEnd] = useState<string>('2028-06-25');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [supaAuthEmail, setSupaAuthEmail] = useState<string>('alihsansoborejo@gmail.com');
  const [supaAuthPassword, setSupaAuthPassword] = useState<string>('AlIhsan2026!');
  const [supaAuthLoading, setSupaAuthLoading] = useState<boolean>(false);
  const [supaAuthError, setSupaAuthError] = useState<string | null>(null);
  const [dbCheckState, setDbCheckState] = useState<{
    checking: boolean;
    reachable: boolean;
    hasAuthSession: boolean;
    authEmail: string | null;
    tablesReady: number;
    totalChecked: number;
    isQuotaExceeded: boolean;
    errorMessage: string | null;
  }>({
    checking: false,
    reachable: false,
    hasAuthSession: false,
    authEmail: null,
    tablesReady: 0,
    totalChecked: 25,
    isQuotaExceeded: false,
    errorMessage: null,
  });

  const supabaseStatus = getSupabaseConfigStatus();
  const effectiveLocalMode = liveSupabaseStatus === 'local_mode' || isLocalMode;

  useEffect(() => {
    setIsLocalMode(liveSupabaseStatus === 'local_mode' || isSupabaseBypassed());
  }, [liveSupabaseStatus]);

  const checkSupabaseConnection = async () => {
    if (isSupabaseBypassed()) {
      setIsLocalMode(true);
      setDbCheckState({
        checking: false,
        reachable: false,
        hasAuthSession: false,
        authEmail: null,
        tablesReady: 0,
        totalChecked: 25,
        isQuotaExceeded: false,
        errorMessage: null,
      });
      return;
    }

    if (!isSupabaseConfigured) {
      setDbCheckState({
        checking: false,
        reachable: false,
        hasAuthSession: false,
        authEmail: null,
        tablesReady: 0,
        totalChecked: 25,
        isQuotaExceeded: false,
        errorMessage: 'Variabel lingkungan VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY belum diatur pada Secrets.',
      });
      return;
    }

    resetSupabaseCircuitBreaker();
    setDbCheckState((prev) => ({ ...prev, checking: true, errorMessage: null, isQuotaExceeded: false }));
    const tablesToCheck = [
      'system_settings',
      'academic_years',
      'semesters',
      'profiles',
      'user_roles',
      'classes',
      'subjects',
      'teachers',
      'students',
      'class_members',
      'teaching_assignments',
      'homeroom_assignments',
      'teaching_journals',
      'student_attendance',
      'assessments',
      'grades',
      'remedial_records',
      'enrichment_records',
      'document_links',
      'supervision_records',
      'student_guidance_records',
      'notifications',
      'activity_logs',
      'app_sync_state',
      'app_user_credentials',
    ];

    try {
      const [{ data: sessionData }, ...results] = await Promise.all([
        supabase.auth.getSession(),
        ...tablesToCheck.map((tbl) =>
          tbl === 'app_sync_state'
            ? supabase.from(tbl).select('key', { count: 'exact', head: true })
            : tbl === 'app_user_credentials'
            ? supabase.from(tbl).select('email', { count: 'exact', head: true })
            : supabase.from(tbl).select('id', { count: 'exact', head: true })
        ),
      ]);
      const sessionUser = sessionData?.session?.user || null;
      const firstErr = results.find((r) => r.error)?.error || null;
      reportSupabaseOutcome(firstErr);
      const isQuotaExceeded = detectSupabaseQuotaError(firstErr);
      const isMissingTableErr = (err: any) =>
        err?.code === '42P01' ||
        err?.code === 'PGRST205' ||
        String(err?.message || '').toLowerCase().includes('could not find the table');
      const readyCount = isQuotaExceeded
        ? 0
        : results.filter((r) => !r.error || !isMissingTableErr(r.error)).length;
      setDbCheckState({
        checking: false,
        reachable: !isQuotaExceeded,
        hasAuthSession: Boolean(sessionUser),
        authEmail: sessionUser?.email || null,
        tablesReady: readyCount,
        totalChecked: tablesToCheck.length,
        isQuotaExceeded,
        errorMessage: firstErr ? `${firstErr.message} (${firstErr.code || 'Error'})` : null,
      });
    } catch (err: any) {
      reportSupabaseOutcome(err);
      const isQuotaExceeded = detectSupabaseQuotaError(err);
      setDbCheckState({
        checking: false,
        reachable: false,
        hasAuthSession: false,
        authEmail: null,
        tablesReady: 0,
        totalChecked: tablesToCheck.length,
        isQuotaExceeded,
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

  const loadData = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [sets, years, sems] = await Promise.all([
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
      ]);
      if (!silent || !isSettingsDirtyRef.current) {
        setSettings(sets);
      }
      setAcademicYears(years);
      setSemesters(sems);
    } catch (err) {
      console.error('Error loading academic data:', err);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const updateSettingField = <K extends keyof SystemSettings>(
    field: K,
    value: SystemSettings[K]
  ) => {
    isSettingsDirtyRef.current = true;
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  useEffect(() => {
    void loadData(false);
    void checkSupabaseConnection();
  }, []);

  useRealtimeSync(['simpel_settings', 'simpel_academic_years', 'simpel_semesters'], () => {
    void loadData(true);
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const updated = await academicService.updateSettings(settings);
      isSettingsDirtyRef.current = false;
      notifyDomFormSaved();
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

  const handleToggleLocalMode = async () => {
    const nextBypass = !effectiveLocalMode;
    setSupabaseBypassed(nextBypass);
    setIsLocalMode(nextBypass);
    if (nextBypass) {
      setDbCheckState((prev) => ({
        ...prev,
        checking: false,
        isQuotaExceeded: false,
        errorMessage: null,
      }));
      setStatusMessage(
        'Mode Server Lokal diaktifkan! Seluruh perangkat pada URL ini kini berjalan cepat & sinkron real-time tanpa bergantung pada Supabase.'
      );
    } else {
      setStatusMessage('Koneksi Supabase diaktifkan kembali. Memeriksa status koneksi...');
      await checkSupabaseConnection();
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupFeedback(null);
    try {
      const res = await fetch(`/api/sync/state?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Server mengembalikan status ${res.status}`);
      }
      const data = await res.json();
      const entries = data?.entries && typeof data.entries === 'object' ? data.entries : {};
      const payload = {
        app: 'SIMPEL MI AL IHSAN',
        version: 1,
        exportedAt: new Date().toISOString(),
        revision: Number(data?.revision || 0),
        entryCount: Object.keys(entries).length,
        entries,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateTag = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `cadangan-simpel-mi-alihsan-${dateTag}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupFeedback({
        type: 'success',
        text: `Cadangan lengkap (${Object.keys(entries).length} grup data termasuk akun, penugasan, jurnal, nilai, dan logo madrasah) berhasil diunduh.`,
      });
    } catch (err: any) {
      setBackupFeedback({
        type: 'error',
        text: `Gagal mengunduh cadangan data: ${err?.message || 'Terjadi kesalahan jaringan.'}`,
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setRestoreLoading(true);
    setBackupFeedback(null);
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const entries = parsed?.entries;
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        throw new Error('Format file cadangan tidak valid (data entries tidak ditemukan).');
      }

      const now = new Date().toISOString();
      const mutations: Array<{ key: string; value: string | null; updatedAt: string }> = [];
      for (const [key, entry] of Object.entries(entries as Record<string, any>)) {
        if (!isSyncedKey(key)) continue;
        if (entry && typeof entry === 'object' && 'value' in entry) {
          if (typeof entry.value === 'string' || entry.value === null) {
            mutations.push({
              key,
              value: entry.value,
              updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
            });
          }
        } else if (typeof entry === 'string' || entry === null) {
          mutations.push({ key, value: entry, updatedAt: now });
        }
      }

      if (mutations.length === 0) {
        throw new Error('Tidak ada data SIMPEL yang valid di dalam file cadangan tersebut.');
      }

      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: `backup-restore-${Date.now().toString(36)}`,
          mutations,
        }),
      });
      if (!res.ok) {
        throw new Error(`Gagal memulihkan data ke server (HTTP ${res.status}).`);
      }

      await syncService.pullFromServer(0, { priorityFast: false });
      await loadData();
      await refreshProfile();
      setIsLocalMode(isSupabaseBypassed());

      setBackupFeedback({
        type: 'success',
        text: `Pemulihan berhasil! ${mutations.length} grup data telah dipulihkan dan disinkronkan ke seluruh perangkat aktif.`,
      });
      setStatusMessage('Data cadangan berhasil dipulihkan ke server aplikasi.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setBackupFeedback({
        type: 'error',
        text: err?.message || 'File cadangan tidak dapat dibaca atau format JSON rusak.',
      });
    } finally {
      setRestoreLoading(false);
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
            effectiveLocalMode
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : dbCheckState.isQuotaExceeded || liveSupabaseStatus === 'quota_exceeded'
              ? 'text-rose-800 bg-rose-50 border-rose-200'
              : isSupabaseConfigured && liveSupabaseStatus === 'connected'
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : 'text-amber-800 bg-amber-50 border-amber-200'
          }`}
        >
          <Database
            className={`w-4 h-4 ${
              effectiveLocalMode
                ? 'text-emerald-700'
                : dbCheckState.isQuotaExceeded || liveSupabaseStatus === 'quota_exceeded'
                ? 'text-rose-600'
                : isSupabaseConfigured && liveSupabaseStatus === 'connected'
                ? 'text-emerald-700'
                : 'text-amber-600'
            }`}
          />
          <span>
            {effectiveLocalMode
              ? 'Mode Server Lokal Aktif (Gratis & Real-Time)'
              : dbCheckState.isQuotaExceeded || liveSupabaseStatus === 'quota_exceeded'
              ? 'Kuota Supabase Penuh (Sync Server Lokal Aktif)'
              : isSupabaseConfigured && liveSupabaseStatus === 'connected'
              ? 'Tersinkronisasi dengan Database PostgreSQL (Supabase)'
              : 'Sinkronisasi Server Real-Time Lokal Aktif'}
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
                  onChange={(e) => updateSettingField('school_name', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NSM (Nomor Statistik Madrasah)</label>
                <input
                  type="text"
                  value={settings.nsm}
                  onChange={(e) => updateSettingField('nsm', e.target.value)}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={settings.npsn}
                  onChange={(e) => updateSettingField('npsn', e.target.value)}
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
                  onChange={(e) => updateSettingField('kktp_default', Number(e.target.value))}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kepala Madrasah</label>
                <input
                  type="text"
                  value={settings.principal_name}
                  onChange={(e) => updateSettingField('principal_name', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NIP Kepala Madrasah</label>
                <input
                  type="text"
                  value={settings.principal_nip}
                  onChange={(e) => updateSettingField('principal_nip', e.target.value)}
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
                onChange={(e) => updateSettingField('address', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                required
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.is_report_card_locked}
                  onChange={(e) => updateSettingField('is_report_card_locked', e.target.checked)}
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

          {/* Card Status Supabase & Mode Server Lokal */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white rounded-xl border border-emerald-800/60 shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-800/60 gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold text-white">Database &amp; Sinkronisasi</h3>
              </div>
              {effectiveLocalMode ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 shrink-0">
                  Mode Server Lokal
                </span>
              ) : dbCheckState.isQuotaExceeded || liveSupabaseStatus === 'quota_exceeded' ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/25 text-rose-200 border border-rose-400/50 shrink-0">
                  Kuota Egres Penuh
                </span>
              ) : isSupabaseConfigured && dbCheckState.reachable && dbCheckState.tablesReady === dbCheckState.totalChecked && !dbCheckState.errorMessage ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                  Terhubung ({dbCheckState.tablesReady}/{dbCheckState.totalChecked} Tabel)
                </span>
              ) : isSupabaseConfigured ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Perlu Cek ({dbCheckState.tablesReady}/{dbCheckState.totalChecked})
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Server Lokal Aktif
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-300 uppercase font-semibold block">Mode Sinkronisasi:</span>
                  {isSupabaseConfigured && !effectiveLocalMode && (
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
                  {effectiveLocalMode
                    ? 'Server Real-Time Lokal + Google Drive (Tanpa Supabase)'
                    : isSupabaseConfigured
                    ? supabaseStatus.url
                    : 'Server Real-Time Lokal (Supabase tidak dikonfigurasi)'}
                </span>
                {isSupabaseConfigured && !effectiveLocalMode && (
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

              {/* Tombol 1-Klik Mode Server Lokal (Gratis Tanpa Upgrade Pro) */}
              {isSupabaseConfigured && (
                <div className={`p-3 rounded-lg border text-[11px] leading-relaxed space-y-2 ${
                  effectiveLocalMode
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : 'bg-white/5 border-white/15 text-slate-200'
                }`}>
                  {effectiveLocalMode ? (
                    <>
                      <p className="font-semibold text-emerald-200">
                        Mode Server Lokal Aktif — 100% Gratis &amp; Tanpa Batas Kuota Supabase
                      </p>
                      <p className="text-emerald-100/90">
                        Semua permintaan ke Supabase dinonaktifkan agar aplikasi berjalan cepat tanpa pesan error kuota. Pastikan seluruh guru, wali kelas, dan kepala madrasah membuka <strong>1 URL aplikasi yang sama</strong> agar data tetap sinkron real-time.
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-200">
                      Tidak ingin upgrade Supabase ke Pro? Aktifkan <strong>Mode Server Lokal</strong> agar aplikasi tidak lagi mengirim request ke Supabase yang dibatasi dan tetap lancar gratis.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleToggleLocalMode()}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold transition-colors ${
                      effectiveLocalMode
                        ? 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>
                      {effectiveLocalMode
                        ? 'Aktifkan Kembali Koneksi Supabase'
                        : 'Aktifkan Mode Server Lokal (Gratis Tanpa Pro)'}
                    </span>
                  </button>
                </div>
              )}

              {!effectiveLocalMode && (dbCheckState.isQuotaExceeded || liveSupabaseStatus === 'quota_exceeded') && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-400/40 text-[11px] text-rose-100 leading-relaxed space-y-1.5">
                  <div className="flex items-start gap-2 font-bold text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                    <span>Proyek Supabase Dibatasi (exceed_egress_quota)</span>
                  </div>
                  <p>
                    Kuota transfer data (<em>egress</em>) paket Free Supabase telah habis. Klik tombol hijau <strong>Aktifkan Mode Server Lokal</strong> di atas untuk menghilangkan gangguan dan menjalankan seluruh fitur secara gratis tanpa upgrade Pro.
                  </p>
                </div>
              )}

              {!isSupabaseConfigured ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Aplikasi saat ini menggunakan <strong>Sinkronisasi Server Real-Time Lokal</strong> secara penuh.
                  </span>
                </div>
              ) : !effectiveLocalMode && !dbCheckState.hasAuthSession ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Env Supabase aktif, namun sesi saat ini masih memakai sesi lokal (belum ada token Auth Supabase). Masukkan email &amp; sandi user yang sudah Anda buat di <strong>Supabase Auth → Users</strong>:
                    </span>
                  </div>

                  <div className="space-y-1.5 bg-black/25 p-2 rounded-lg border border-white/10">
                    <input
                      type="email"
                      value={supaAuthEmail}
                      onChange={(e) => setSupaAuthEmail(e.target.value)}
                      placeholder="Email Supabase Auth"
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900/90 border border-white/15 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="password"
                      value={supaAuthPassword}
                      onChange={(e) => setSupaAuthPassword(e.target.value)}
                      placeholder="Kata sandi user Supabase Auth"
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900/90 border border-white/15 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                    />
                    {supaAuthError && (
                      <p className="text-[10px] text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded p-1.5 leading-snug">
                        {supaAuthError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={supaAuthLoading}
                      onClick={async () => {
                        setSupaAuthLoading(true);
                        setSupaAuthError(null);
                        try {
                          await signInSupabaseStrict(supaAuthEmail, supaAuthPassword);
                          await refreshProfile();
                          await syncService.syncNow();
                          await checkSupabaseConnection();
                          setStatusMessage('Sesi Auth Supabase berhasil terhubung & seluruh data disinkronkan ke cloud!');
                        } catch (err: any) {
                          setSupaAuthError(err?.message || 'Gagal masuk ke Supabase Auth.');
                        } finally {
                          setSupaAuthLoading(false);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold transition-colors disabled:opacity-50"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{supaAuthLoading ? 'Menghubungkan...' : 'Hubungkan Sesi Auth Supabase'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] font-semibold transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Atau Logout ke Halaman Login</span>
                  </button>
                </div>
              ) : !effectiveLocalMode && dbCheckState.errorMessage ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed">
                  Catatan verifikasi: {dbCheckState.errorMessage}
                </div>
              ) : null}

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Skrip migrasi database lengkap (42 tabel) tersedia bila suatu saat ingin berpindah ke project Supabase gratis baru.
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
                  href={
                    supabaseStatus.projectRef
                      ? `https://supabase.com/dashboard/project/${supabaseStatus.projectRef}/sql/new`
                      : 'https://supabase.com/dashboard/projects'
                  }
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

          {/* Card Cadangan & Transfer Data Lengkap (.json) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <HardDrive className="w-5 h-5 text-emerald-800 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cadangan &amp; Transfer Data (.json)</h3>
                <p className="text-[11px] text-slate-500">Simpan salinan aman atau pindahkan data antar-URL secara gratis</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Ekspor seluruh data madrasah (akun pengguna, logo, kelas, guru, siswa, penugasan mapel, jurnal mengajar, nilai, &amp; supervisi) menjadi 1 berkas <code className="text-emerald-800 font-mono">.json</code>, atau pulihkan kembali kapan saja.
            </p>

            {backupFeedback && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                  backupFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {backupFeedback.text}
              </div>
            )}

            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleRestoreBackupFile(e)}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={backupLoading || restoreLoading}
                onClick={() => void handleExportBackup()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{backupLoading ? 'Mengunduh...' : 'Unduh Cadangan (.json)'}</span>
              </button>

              <button
                type="button"
                disabled={backupLoading || restoreLoading}
                onClick={() => backupFileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-800" />
                <span>{restoreLoading ? 'Memulihkan...' : 'Pulihkan (.json)'}</span>
              </button>
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
