import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requestPasswordReset } from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { Modal } from '../../components/ui/Modal';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  KeyRound,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo, isLoading, error } = useAuth();
  const [email, setEmail] = useState('alihsansoborejo@gmail.com');
  const [password, setPassword] = useState('AlIhsan2026!');
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

    if (!email) {
      setLocalError('Harap isi alamat email Anda.');
      return;
    }

    try {
      await login(email, password || 'AlIhsan2026!');
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

  const handleDirectDemoLogin = async (target: 'admin' | 'kamad' | 'guru' | 'pjok') => {
    setLocalError(null);
    try {
      await loginAsDemo(target);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100/70">
      {/* Kolom Kiri: Visual Branding Madrasah */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-800/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700/80 border border-emerald-600 flex items-center justify-center font-extrabold text-amber-300 text-xl shadow-inner">
            IH
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">MI MA’ARIF AL IHSAN</h1>
            <p className="text-xs text-emerald-200">Soborejo, Pringsurat, Temanggung</p>
          </div>
        </div>

        {/* Center Philosophy */}
        <div className="relative z-10 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/70 border border-emerald-700/60 text-xs text-amber-300 mb-6 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Kurikulum Merdeka & Berbasis Cinta</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            Sistem Informasi Manajemen Pembelajaran (SIMPEL)
          </h2>
          <p className="mt-4 text-sm text-emerald-100 leading-relaxed">
            Mewujudkan ekosistem pembelajaran mendalam yang terintegrasi, transparan, dan berpusat pada perkembangan peserta didik dengan landasan kasih sayang dan akhlakul karimah.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-800/50 border border-emerald-700/50">
              <p className="font-semibold text-amber-300">Google Drive Terpadu</p>
              <p className="mt-1 text-emerald-200 text-[11px]">Penyimpanan perangkat ajar aman tanpa beban kuota database.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-800/50 border border-emerald-700/50">
              <p className="font-semibold text-amber-300">Asisten Cerdas Gemini</p>
              <p className="mt-1 text-emerald-200 text-[11px]">Bantuan penyusunan TP, ATP, Modul Ajar, dan LKPD diferensiasi.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-emerald-300/80 flex items-center justify-between border-t border-emerald-800/70 pt-6">
          <span>Tahun Pelajaran 2026/2027</span>
          <span>Zona Waktu Asia/Jakarta (WIB)</span>
        </div>
      </div>

      {/* Kolom Kanan: Formulir Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-emerald-800 text-amber-300 font-bold flex items-center justify-center text-lg">
              IH
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">SIMPEL MI AL IHSAN</h2>
              <p className="text-xs text-slate-500">MI Ma’arif Al Ihsan Soborejo</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Masuk ke Portal</h2>
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
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@alihsan.sch.id"
                    className="w-full pl-9 pr-3 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
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
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Lupa sandi?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 focus:ring-4 focus:ring-emerald-200 transition-all shadow-xs disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk ke SIMPEL</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Switcher (Bila menguji tanpa kredensial) */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>Masuk Cepat 1-Klik (Uji Coba Demo)</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-medium">Langsung Aktif</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleDirectDemoLogin('admin')}
                  className="p-2.5 text-left rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-600 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">1. Admin Madrasah</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-800 text-white font-semibold">1-Klik</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">alihsansoborejo@gmail.com</p>
                  <p className="text-[10px] text-emerald-800 mt-1 font-medium">Akses kelola akun & master data</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectDemoLogin('kamad')}
                  className="p-2.5 text-left rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-100/60 hover:border-purple-600 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">2. Kepala Madrasah</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-800 text-white font-semibold">1-Klik</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">kamad@alihsan.sch.id</p>
                  <p className="text-[10px] text-purple-800 mt-1 font-medium">Supervisi dokumen Drive & KBM</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectDemoLogin('guru')}
                  className="p-2.5 text-left rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 hover:border-amber-600 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">3. Guru & Wali Kelas</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-700 text-white font-semibold">Multi-Peran</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">guru@alihsan.sch.id</p>
                  <p className="text-[10px] text-amber-800 mt-1 font-medium">Beralih Dasbor Guru & Wali Kelas 4</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectDemoLogin('pjok')}
                  className="p-2.5 text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">4. Guru Pengampu</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-700 text-white font-semibold">1-Klik</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">guru.pjok@alihsan.sch.id</p>
                  <p className="text-[10px] text-slate-600 mt-1 font-medium">Jurnal, nilai & presensi mapel</p>
                </button>
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center text-[11px] text-slate-600">
                <span>Atau masuk manual menggunakan email Anda: </span>
                <span className="font-mono font-bold text-emerald-800">alihsansoborejo@gmail.com</span>
                <span> (Sandi: </span>
                <span className="font-mono font-bold text-emerald-800">AlIhsan2026!</span>
                <span>)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[11px] text-slate-400">
              SIMPEL MI AL IHSAN v1.0 · MI Ma’arif Al Ihsan Soborejo
            </p>
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
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
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
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-50"
            >
              {isForgotLoading ? 'Mengirim...' : 'Kirim Tautan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
