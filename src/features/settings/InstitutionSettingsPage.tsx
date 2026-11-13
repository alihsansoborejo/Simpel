import React, { useState, useEffect } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext';
import {
  School,
  Save,
  CheckCircle,
  AlertCircle,
  Upload,
  RotateCcw,
  Clock,
  BookOpen,
  Heart,
  Globe,
  MapPin,
  UserCheck,
  FileText,
  Sparkles,
} from 'lucide-react';

export const InstitutionSettingsPage: React.FC = () => {
  const { settings, logoUrl, faviconUrl, updateSettings, setLogoAndFavicon, resetToDefaultBrand } = useAppSettings();

  const [schoolName, setSchoolName] = useState(settings?.school_name || "MI Ma'arif Al Ihsan Soborejo");
  const [address, setAddress] = useState(settings?.address || 'Soborejo, Pringsurat, Temanggung, Jawa Tengah');
  const [principalName, setPrincipalName] = useState(settings?.principal_name || 'MUIN, S.Pd.I');
  const [principalNip, setPrincipalNip] = useState(settings?.principal_nip || '197508152005011004');
  const [nsm, setNsm] = useState(settings?.nsm || '111233230045');
  const [npsn, setNpsn] = useState(settings?.npsn || '60712345');
  const [kktpDefault, setKktpDefault] = useState(settings?.kktp_default || 75);
  const [timezone, setTimezone] = useState('Asia/Jakarta (WIB)');
  const [curriculumName, setCurriculumName] = useState('Kurikulum Merdeka (KMA 450 Tahun 2024)');
  const [learningApproach, setLearningApproach] = useState('Kurikulum Berbasis Cinta (KBC) & Pembelajaran Mendalam (Deep Learning)');
  const [reportHeaderTitle, setReportHeaderTitle] = useState('LEMBAR LAPORAN HASIL BELAJAR PESERTA DIDIK (RAPOR)');

  // Logo & favicon custom URLs or data-URI
  const [customLogo, setCustomLogo] = useState(logoUrl);
  const [customFavicon, setCustomFavicon] = useState(faviconUrl);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setSchoolName(settings.school_name || "MI Ma'arif Al Ihsan Soborejo");
    setAddress(settings.address || 'Soborejo, Pringsurat, Temanggung, Jawa Tengah');
    setPrincipalName(settings.principal_name || 'MUIN, S.Pd.I');
    setPrincipalNip(settings.principal_nip || '197508152005011004');
    setNsm(settings.nsm || '111233230045');
    setNpsn(settings.npsn || '60712345');
    setKktpDefault(settings.kktp_default || 75);
    if (settings.logo_url) setCustomLogo(settings.logo_url);
    if (settings.favicon_url) setCustomFavicon(settings.favicon_url);
  }, [settings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas gambar maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUri = uploadEvent.target?.result as string;
      if (type === 'logo') {
        setCustomLogo(dataUri);
      } else {
        setCustomFavicon(dataUri);
      }
      setStatusMessage(`Pratinjau ${type === 'logo' ? 'Logo' : 'Favicon'} diperbarui. Klik Simpan untuk menerapkan.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await updateSettings({
        school_name: schoolName,
        address,
        principal_name: principalName,
        principal_nip: principalNip,
        nsm,
        npsn,
        kktp_default: Number(kktpDefault),
        logo_url: customLogo,
        favicon_url: customFavicon,
      });

      await setLogoAndFavicon(customLogo, customFavicon);

      setStatusMessage('Profil Identitas Madrasah berhasil diperbarui dan diterapkan ke seluruh sistem!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan konfigurasi identitas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBrand = async () => {
    if (confirm('Kembalikan logo dan favicon ke logo standar MI Ma’arif Al Ihsan?')) {
      await resetToDefaultBrand();
      setCustomLogo('/logo-mi-alihsan.svg');
      setCustomFavicon('/favicon.svg');
      setStatusMessage('Logo dan Favicon dikembalikan ke standar awal.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <School className="w-5 h-5 text-emerald-800" />
            <span>Konfigurasi Identitas & Branding Madrasah</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengaturan resmi identitas lembaga, kepala madrasah, logo, favicon, zona waktu, dan kop laporan (Tahap 8).
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Zona Waktu: Asia/Jakarta (WIB)</span>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-800 bg-rose-50 rounded-lg border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Section 1: Logo & Favicon */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Logo & Ikon Madrasah (Branding)</h3>
              <p className="text-xs text-slate-500">Logo ditampilkan pada sidebar, kop rapor, dan dokumen cetak</p>
            </div>
            <button
              type="button"
              onClick={handleResetBrand}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Madrasah */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="w-20 h-20 rounded-xl bg-white p-2 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                <img
                  src={customLogo || '/logo-mi-alihsan.svg'}
                  alt="Logo Madrasah"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="space-y-2 flex-1">
                <label className="block text-xs font-bold text-slate-800">Logo Aplikasi / Madrasah</label>
                <p className="text-[11px] text-slate-500">Format PNG, SVG, JPG (disarankan rasio 1:1, maks 2MB)</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Favicon Browser */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="w-20 h-20 rounded-xl bg-white p-2 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                <img
                  src={customFavicon || '/favicon.svg'}
                  alt="Favicon Tab"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="space-y-2 flex-1">
                <label className="block text-xs font-bold text-slate-800">Favicon Tab Browser</label>
                <p className="text-[11px] text-slate-500">Ikon kecil tab browser saat aplikasi dibuka guru/wali</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Favicon</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'favicon')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Data Pokok Lembaga */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Data Pokok Kelembagaan</h3>
            <p className="text-xs text-slate-500">Identitas resmi yang tercantum pada buku rapor, surat tugas, dan dokumen pembelajaran</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Resmi Madrasah</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 font-semibold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Statistik Madrasah (NSM)</label>
              <input
                type="text"
                value={nsm}
                onChange={(e) => setNsm(e.target.value)}
                className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Pokok Sekolah Nasional (NPSN)</label>
              <input
                type="text"
                value={npsn}
                onChange={(e) => setNpsn(e.target.value)}
                className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">KKTP / KBM Standar Madrasah</label>
              <input
                type="number"
                min="50"
                max="100"
                value={kktpDefault}
                onChange={(e) => setKktpDefault(Number(e.target.value))}
                className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900 font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap Madrasah</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
              required
            />
          </div>
        </div>

        {/* Section 3: Pimpinan Madrasah & Kebijakan Kurikulum */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Kepala Madrasah & Karakteristik Kurikulum</h3>
            <p className="text-xs text-slate-500">Penandatangan resmi dokumen akademik dan landasan filosofis pembelajaran</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kepala Madrasah (dengan Gelar)</label>
              <input
                type="text"
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NUPTK Kepala Madrasah</label>
              <input
                type="text"
                value={principalNip}
                onChange={(e) => setPrincipalNip(e.target.value)}
                className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kurikulum Acuan</label>
              <input
                type="text"
                value={curriculumName}
                onChange={(e) => setCurriculumName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pendekatan & Landasan Cinta</label>
              <input
                type="text"
                value={learningApproach}
                onChange={(e) => setLearningApproach(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Kop Dokumen Laporan / Rapor</label>
            <input
              type="text"
              value={reportHeaderTitle}
              onChange={(e) => setReportHeaderTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 text-slate-900 font-mono"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan Konfigurasi...' : 'Simpan Semua Konfigurasi Identitas'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
