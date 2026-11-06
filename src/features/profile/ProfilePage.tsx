import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile, requestPasswordReset } from '../../services/authService';
import { ROLE_CONFIGS } from '../../types/auth.types';
import {
  User,
  Mail,
  Phone,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.profile?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.profile?.phone_number || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset password state
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateUserProfile(user.id, {
        full_name: fullName,
        phone_number: phoneNumber,
      });
      await refreshProfile();
      setSuccessMessage('Data profil Anda berhasil diperbarui.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setIsResetting(true);
    setResetMessage(null);
    try {
      const msg = await requestPasswordReset(user.email);
      setResetMessage(msg);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Profil & Pengaturan Akun
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Informasi identitas kepegawaian dan pengaturan keamanan akun madrasah
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-800 text-white font-extrabold text-2xl flex items-center justify-center shadow-inner">
          {user?.profile?.full_name?.charAt(0) || 'U'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {user?.profile?.full_name}
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Akun Aktif
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {user?.roles.map((r) => {
              const cfg = ROLE_CONFIGS[r];
              return (
                <span
                  key={r}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.badgeColor}`}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Edit Data & Keamanan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Edit Form */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-700" />
            <span>Perbarui Informasi Pribadi</span>
          </h4>

          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Lengkap & Gelar
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email Akun
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Alamat email terikat pada sistem autentikasi. Hubungi Admin jika perlu perubahan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor Handphone / WhatsApp
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan Perubahan...' : 'Simpan Pembaruan'}
              </button>
            </div>
          </form>
        </div>

        {/* Kolom 3: Keamanan Sandi & Info Peran */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span>Keamanan Kata Sandi</span>
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Perbarui kata sandi Anda secara berkala untuk menjaga kerahasiaan data penilaian dan siswa.
            </p>

            {resetMessage ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {resetMessage}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={isResetting}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
              >
                {isResetting ? 'Mengirim...' : 'Kirim Tautan Ubah Sandi'}
              </button>
            )}
          </div>

          <div className="bg-emerald-50/60 rounded-xl border border-emerald-200/80 p-5">
            <h4 className="text-xs font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-700" />
              <span>Integritas Hak Akses</span>
            </h4>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Penetapan peran dan hak akses pada SIMPEL MI AL IHSAN dikontrol penuh oleh Administrator madrasah. Pengguna tidak diperkenankan mengubah hak akses secara mandiri demi keamanan RLS database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
