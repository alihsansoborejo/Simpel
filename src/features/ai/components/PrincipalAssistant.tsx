import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  Copy,
  Download,
  Printer,
  Save,
  RefreshCw,
  Building2,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Users,
} from 'lucide-react';
import { PrincipalAssistantRequest, PrincipalAssistantResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const PrincipalAssistant: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PrincipalAssistantResult | null>(null);

  const [formData, setFormData] = useState<PrincipalAssistantRequest>({
    academicYear: '2024/2025',
    semester: 'Ganjil',
    periodType: 'tengah_semester',
    stats: {
      totalTeachers: 14,
      compliancePercent: 92.8,
      avgStudentAttendance: 96.4,
      supervisionCompletedCount: 10,
      supervisionNeedFollowupCount: 2,
      averageSchoolScore: 83.1,
    },
    focusConcern: 'Penguatan integrasi Kurikulum Berbasis Cinta pada proses evaluasi KBM serta tindak lanjut hasil supervisi klinis guru pemula.',
  });

  const handleGenerate = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const res = await aiService.generatePrincipalAssistant(formData);
      setResult(res);

      await aiService.logUsage({
        userId: user?.id || 'kamad-01',
        userName: user?.profile?.full_name || 'Kepala Madrasah',
        userRole: activeRole || 'kepala_madrasah',
        featureType: 'kepala_madrasah',
        promptSummary: `Telaah Eksekutif Kamad: Semester ${formData.semester} T.A. ${formData.academicYear}`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.('Laporan eksekutif dan poin arahan rapat berhasil disusun!', 'success');
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal memproses telaah kepala madrasah.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMeetingPoints = async () => {
    if (!result) return;
    const text = `
MATERI BRIEFING & ARAHAN KEPALA MADRASAH
RAPAT DEWAN GURU MI MA'ARIF AL IHSAN SOBOREJO
Periode: ${result.periodeAnalisis}

I. RINGKASAN EKSEKUTIF
${result.ringkasanEksekutif}

II. POIN UTAMA ARAHAN KEPALA MADRASAH
${result.poinArahanRapatDewanGuru.map((p, i) => `${i + 1}. ${p}`).join('\n\n')}

III. REKOMENDASI PENINGKATAN MUTU
${result.rekomendasiPeningkatanMutu.map((r, i) => `${i + 1}. ${r}`).join('\n')}

IV. CATATAN BATASAN DATA
${result.batasanInterpretasi}
    `.trim();

    const ok = await aiService.copyText(text);
    if (ok) onNotify?.('Materi rapat dewan guru berhasil disalin!', 'success');
  };

  const handleExportWord = () => {
    if (!result) return;
    const html = `
      <h1 style="text-align: center; color: #047857; margin-bottom: 2pt;">TELAAH MANAJERIAL & BAHAN RAPAT DEWAN GURU</h1>
      <h2 style="text-align: center; color: #1e293b; font-size: 13pt; margin-top: 0;">${result.periodeAnalisis}</h2>
      <p style="text-align: center; font-size: 10pt; color: #64748b;">MI Ma'arif Al Ihsan Soborejo</p>
      <br/>

      <h3>A. RINGKASAN EKSEKUTIF KONDISI AKADEMIK</h3>
      <p style="line-height: 1.6;">${result.ringkasanEksekutif}</p>

      <h3>B. DASAR DATA DAN RUJUKAN INFORMASI</h3>
      <ul>${result.dasarDataDigunakan.map((d) => `<li>${d}</li>`).join('')}</ul>

      <h3>C. EVALUASI PRESENSI & ADMINISTRASI GURU</h3>
      <table style="width: 100%; border: 1px solid #94a3b8; margin-bottom: 12pt;">
        <tr><td style="width: 35%;"><b>Tingkat Kehadiran Siswa</b></td><td>${result.analisisKehadiranSiswa.kondisi} (Tren: ${result.analisisKehadiranSiswa.tren})</td></tr>
        <tr><td><b>Kepatuhan Perangkat Ajar</b></td><td>${result.evaluasiAdministrasiGuru.tingkatKepatuhan} - ${result.evaluasiAdministrasiGuru.catatanKelengkapan}</td></tr>
      </table>

      <h3>D. REKAPITULASI HASIL SUPERVISI AKADEMIK</h3>
      <p><b>Aspek Praktik Baik (Kekuatan):</b></p>
      <ul>${result.evaluasiSupervisiKbm.aspekKuat.map((k) => `<li>${k}</li>`).join('')}</ul>
      <p><b>Aspek yang Memerlukan Tindak Lanjut:</b></p>
      <ul>${result.evaluasiSupervisiKbm.aspekPerluPerbaikan.map((p) => `<li>${p}</li>`).join('')}</ul>

      <h3>E. POIN UTAMA PENGARAHAN RAPAT DEWAN GURU</h3>
      <ol style="line-height: 1.6;">
        ${result.poinArahanRapatDewanGuru.map((p) => `<li>${p}</li>`).join('')}
      </ol>

      <h3>F. REKOMENDASI PENINGKATAN MUTU STRATEGIS</h3>
      <ol>
        ${result.rekomendasiPeningkatanMutu.map((r) => `<li>${r}</li>`).join('')}
      </ol>

      <div style="background-color: #f8fafc; border: 1pt solid #cbd5e1; padding: 8pt; margin-top: 14pt; font-size: 9pt; color: #64748b;">
        <b>Batasan Interpretasi:</b> ${result.batasanInterpretasi}
      </div>
    `;

    aiService.exportToWord(
      `Telaah_Kepala_Madrasah_${formData.academicYear.replace('/', '-')}_${formData.semester}`,
      `Telaah Manajerial Kepala Madrasah`,
      html
    );
    onNotify?.('Laporan telaah kepala madrasah diekspor ke Word (.doc)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Eksekutif Kepala Madrasah</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Asisten Analisis Mutu Madrasah, Supervisi, & Bahan Rapat Dewan Guru
        </h2>
        <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
          Menyajikan ringkasan manajerial komprehensif bagi Pimpinan Madrasah: evaluasi tren kehadiran siswa, kepatuhan perangkat ajar guru, tindak lanjut supervisi klinis, dan draf arahan rapat pleno dewan guru.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Periode & Parameter Manajerial</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tahun Ajaran</label>
                <input
                  type="text"
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Semester</label>
                <select
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="Ganjil">Semester Ganjil</option>
                  <option value="Genap">Semester Genap</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Periode Evaluasi</label>
              <select
                value={formData.periodType}
                onChange={(e) => setFormData({ ...formData, periodType: e.target.value as any })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="tengah_semester">Evaluasi Tengah Semester (STS)</option>
                <option value="akhir_semester">Evaluasi Akhir Semester (SAS / Rapor)</option>
                <option value="bulanan">Monitoring Rutin Bulanan</option>
              </select>
            </div>

            {/* Metrik Operasional Madrasah */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="font-bold text-slate-800 text-[11px] block">Dasar Indikator Akademik (Data SIMPEL):</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Kepatuhan Perangkat Guru:</span>
                  <input
                    type="number"
                    value={formData.stats.compliancePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stats: { ...formData.stats, compliancePercent: Number(e.target.value) },
                      })
                    }
                    className="w-full font-bold text-emerald-800 border border-slate-300 rounded p-1 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block">Rata-rata Presensi Siswa:</span>
                  <input
                    type="number"
                    value={formData.stats.avgStudentAttendance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stats: { ...formData.stats, avgStudentAttendance: Number(e.target.value) },
                      })
                    }
                    className="w-full font-bold text-emerald-800 border border-slate-300 rounded p-1 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block">Guru Telah Disupervisi:</span>
                  <input
                    type="number"
                    value={formData.stats.supervisionCompletedCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stats: { ...formData.stats, supervisionCompletedCount: Number(e.target.value) },
                      })
                    }
                    className="w-full font-bold text-slate-800 border border-slate-300 rounded p-1 bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block">Perlu Tindak Lanjut:</span>
                  <input
                    type="number"
                    value={formData.stats.supervisionNeedFollowupCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stats: { ...formData.stats, supervisionNeedFollowupCount: Number(e.target.value) },
                      })
                    }
                    className="w-full font-bold text-amber-700 border border-slate-300 rounded p-1 bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Fokus Arahan / Catatan Khusus Pimpinan:
              </label>
              <textarea
                rows={3}
                value={formData.focusConcern}
                onChange={(e) => setFormData({ ...formData, focusConcern: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 leading-relaxed"
                placeholder="Fokus isu yang ingin ditekankan dalam rapat..."
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI Sedang Menyusun Telaah Manajerial...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Susun Telaah & Materi Rapat Dewan Guru</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Area (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-full min-h-[600px]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800">
                {result ? `Telaah Mutu: ${result.periodeAnalisis}` : 'Pratinjau Telaah Kepala Madrasah'}
              </span>

              {result && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={handleCopyMeetingPoints}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1 font-semibold"
                    title="Salin Poin Arahan Rapat"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Poin Rapat</span>
                  </button>

                  <button
                    onClick={handleExportWord}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-1 hover:bg-blue-700 shadow-xs"
                    title="Ekspor ke Word"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>

                  <button
                    onClick={() => aiService.exportToPrintPDF('preview-principal-content')}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Cetak Dokumen"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h4 className="text-sm font-bold text-slate-700">Menganalisis Kinerja Akademik Madrasah</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Mengkonsolidasikan data kepatuhan kurikulum guru, tren kehadiran siswa, dan merumuskan poin pembinaan rapat guru yang penuh wibawa dan kasih sayang...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Building2 className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada Telaah Dibuat</h4>
                <p className="text-xs max-w-xs mt-1">
                  Pilih periode evaluasi dan klik tombol untuk menghasilkan laporan analisis mutu dan bahan arahan rapat dewan guru.
                </p>
              </div>
            ) : (
              <div id="preview-principal-content" className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                {/* Ringkasan Eksekutif */}
                <div className="bg-emerald-950 text-white rounded-xl p-4 space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-300 block uppercase tracking-wider">
                    Ringkasan Eksekutif Mutu Pembelajaran:
                  </span>
                  <p className="text-emerald-100 leading-relaxed text-xs">
                    {result.ringkasanEksekutif}
                  </p>
                </div>

                {/* Dasar Data Digunakan */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                  <span className="font-bold text-slate-700 text-[11px] block">Dasar Data Rujukan:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                    {result.dasarDataDigunakan.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>

                {/* Kehadiran & Administrasi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-xl p-3.5 space-y-1 text-[11px]">
                    <span className="font-bold text-slate-800 text-xs block mb-1">
                      Analisis Presensi Siswa:
                    </span>
                    <p><b className="text-slate-600">Kondisi:</b> {result.analisisKehadiranSiswa.kondisi}</p>
                    <p><b className="text-slate-600">Tren:</b> {result.analisisKehadiranSiswa.tren}</p>
                    <p className="text-emerald-700 font-medium">
                      <b>Tindak Lanjut:</b> {result.analisisKehadiranSiswa.rekomendasiTindakLanjut}
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3.5 space-y-1 text-[11px]">
                    <span className="font-bold text-slate-800 text-xs block mb-1">
                      Kelengkapan Administrasi Guru:
                    </span>
                    <p><b className="text-slate-600">Tingkat Kepatuhan:</b> <span className="text-emerald-700 font-bold">{result.evaluasiAdministrasiGuru.tingkatKepatuhan}</span></p>
                    <p className="text-slate-600">{result.evaluasiAdministrasiGuru.catatanKelengkapan}</p>
                  </div>
                </div>

                {/* Supervisi KBM */}
                <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-amber-900 block text-xs">
                    Hasil Pengawasan Supervisi KBM:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <b className="text-emerald-800 block mb-0.5">Praktik Baik (Kekuatan):</b>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                        {result.evaluasiSupervisiKbm.aspekKuat.map((k, i) => <li key={i}>{k}</li>)}
                      </ul>
                    </div>
                    <div>
                      <b className="text-rose-800 block mb-0.5">Perlu Tindak Lanjut:</b>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                        {result.evaluasiSupervisiKbm.aspekPerluPerbaikan.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Poin Pengarahan Rapat Dewan Guru */}
                <div className="border-2 border-emerald-600 bg-emerald-50/50 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-700" />
                      <span>Materi Briefing & Poin Pengarahan Rapat Dewan Guru:</span>
                    </span>
                    <button
                      onClick={handleCopyMeetingPoints}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin Poin</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {result.poinArahanRapatDewanGuru.map((p, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs flex items-start gap-2.5 text-xs">
                        <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-slate-800 leading-relaxed font-medium">{p}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rekomendasi Peningkatan Mutu & Batasan */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">
                    Rekomendasi Strategis Peningkatan Mutu Madrasah:
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px]">
                    {result.rekomendasiPeningkatanMutu.map((r, i) => <li key={i}>{r}</li>)}
                  </ol>
                  <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
                    <b>Catatan Batasan:</b> {result.batasanInterpretasi}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
