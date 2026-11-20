import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { requestPasswordReset } from '../../services/authService';
import { Modal } from '../../components/ui/Modal';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const { logoUrl, settings } = useAppSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Modal lupa password
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Harap isi alamat email dan kata sandi Anda.');
      return;
    }

    try {
      await login(email, password);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotLoading(true);
    setForgotMessage(null);
    try {
      const msg = await requestPasswordReset(forgotEmail);
      setForgotMessage(msg);
    } catch (err: any) {
      setForgotMessage(err.message);
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAF9]">
      {/* Kolom Kiri: Visual Branding Madrasah */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-yellow-400/15 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo Madrasah"
              className="w-12 h-12 object-contain rounded-xl p-1 bg-emerald-950/60 border border-amber-400/60 shadow-md shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 border border-amber-300 flex items-center justify-center font-extrabold text-emerald-950 text-xl shadow-inner shrink-0">
              IH
            </div>
          )}
          <div>
            <h1 className="text-base font-bold tracking-tight text-amber-50">
              {settings?.school_name ? settings.school_name.toUpperCase() : 'MI MA’ARIF AL IHSAN'}
            </h1>
            <p className="text-xs text-amber-300/90">Soborejo, Pringsurat, Temanggung</p>
          </div>
        </div>

        {/* Center Philosophy */}
        <div className="relative z-10 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-amber-400/40 text-xs text-amber-300 mb-6 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Kurikulum Merdeka &amp; Berbasis Cinta</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            Sistem Informasi Manajemen Pembelajaran (SIMPEL)
          </h2>
          <p className="mt-4 text-sm text-emerald-100/90 leading-relaxed">
            Mewujudkan ekosistem pembelajaran mendalam yang terintegrasi, transparan, dan berpusat pada perkembangan peserta didik dengan landasan kasih sayang dan akhlakul karimah.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-950/45 border border-amber-400/35">
              <p className="font-semibold text-amber-300">Google Drive Terpadu</p>
              <p className="mt-1 text-emerald-100/80 text-[11px]">
                Penyimpanan perangkat ajar otomatis ke Drive alihsansoborejo@gmail.com tanpa login di perangkat guru.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-950/45 border border-amber-400/35">
              <p className="font-semibold text-amber-300">Asisten Cerdas Gemini</p>
              <p className="mt-1 text-emerald-100/80 text-[11px]">
                Bantuan penyusunan TP, ATP, Modul Ajar, dan LKPD diferensiasi.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-amber-200/85 flex items-center justify-between border-t border-amber-400/25 pt-6">
          <span>Tahun Pelajaran 2026/2027</span>
          <span>Zona Waktu Asia/Jakarta (WIB)</span>
        </div>
      </div>

      {/* Kolom Kanan: Formulir Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo Madrasah"
                className="w-10 h-10 object-contain rounded-lg p-0.5 bg-emerald-950 border border-amber-400/60 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-emerald-950 font-extrabold flex items-center justify-center text-lg shrink-0">
                IH
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold text-emerald-950 leading-tight">SIMPEL MI AL IHSAN</h2>
              <p className="text-xs text-slate-500">{settings?.school_name || 'MI Ma’arif Al Ihsan Soborejo'}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-emerald-200/80 p-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-emerald-950">Masuk ke Portal</h2>
              <p className="text-xs text-slate-500 mt-1">
                Silakan masukkan email dan kata sandi akun madrasah Anda.
              </p>
            </div>

            {/* Error Message */}
            {(localError || error) && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{localError || error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Email Akun
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-emerald-700 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@alihsan.sch.id"
                    className="w-full pl-9 pr-3 py-2.5 text-xs text-slate-900 bg-emerald-50/30 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-emerald-600 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Kata Sandi</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:text-amber-700 hover:underline"
                  >
                    Lupa sandi?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-emerald-700 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs text-slate-900 bg-emerald-50/30 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-emerald-600 focus:bg-white transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-emerald-800"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 focus:ring-4 focus:ring-amber-200 transition-all shadow-xs disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk ke SIMPEL</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Catatan Pengelolaan Akun */}
            <div className="mt-6 pt-5 border-t border-emerald-100">
              <p className="text-center text-[11px] text-slate-500">
                Akun Guru, Kepala Madrasah, dan Rombel dikelola melalui panel Administrator Madrasah.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Lupa Sandi */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Pemulihan Kata Sandi Akun"
        subtitle="Kirimkan tautan pengaturan ulang kata sandi ke email Anda"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Alamat Email Terdaftar
            </label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="nama@alihsan.sch.id"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          {forgotMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              {forgotMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isForgotLoading}
              className="px-4 py-2 text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 rounded-lg disabled:opacity-50"
            >
              {isForgotLoading ? 'Mengirim...' : 'Kirim Tautan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
