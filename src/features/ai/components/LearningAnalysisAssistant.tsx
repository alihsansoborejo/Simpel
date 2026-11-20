import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Award,
  Copy,
  Download,
  CheckCircle2,
  AlertCircle,
  Users,
  FileSpreadsheet,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { LearningAnalysisRequest, LearningAnalysisResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const LearningAnalysisAssistant: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LearningAnalysisResult | null>(null);

  // Form Data berbasis nilai riil statistik aplikasi
  const [formData, setFormData] = useState<LearningAnalysisRequest>({
    subject: 'Bahasa Indonesia',
    grade: 'Kelas 4',
    topic: 'Sumatif Lingkup Materi 1 (Teks Narasi)',
    kktp: 75,
    totalStudents: 24,
    averageScore: 78.5,
    highestScore: 96,
    lowestScore: 58,
    passCount: 19,
    remedialCount: 5,
    passPercentage: 79.2,
    unachievedObjectives: [
      'Menentukan kalimat transitif dan intransitif dalam teks cerita.',
      'Menemukan ide pokok tersirat pada paragraf narasi ketiga.',
    ],
    commonMistakes: 'Siswa sering tertukar antara subjek dan objek ketika urutan kalimat dibalik atau disisipi keterangan waktu.',
  });

  const handleStatChange = (field: keyof LearningAnalysisRequest, value: any) => {
    const updated = { ...formData, [field]: value };
    // Recalculate auto-percentages
    if (field === 'passCount' || field === 'totalStudents') {
      const total = Number(field === 'totalStudents' ? value : updated.totalStudents) || 1;
      const pass = Number(field === 'passCount' ? value : updated.passCount) || 0;
      updated.remedialCount = Math.max(0, total - pass);
      updated.passPercentage = Number(((pass / total) * 100).toFixed(1));
    }
    setFormData(updated);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const res = await aiService.generateLearningAnalysis(formData);
      setResult(res);

      await aiService.logUsage({
        userId: user?.id || 'guru-anon',
        userName: user?.profile?.full_name || 'Guru MI Al Ihsan',
        userRole: activeRole || 'guru',
        featureType: 'analisis_belajar',
        promptSummary: `Analisis Nilai: ${formData.subject} - ${formData.topic} (Rata-rata: ${formData.averageScore})`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.('Interpretasi kualitatif dan program tindak lanjut berhasil disusun!', 'success');
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal menganalisis hasil belajar.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyNarrative = async () => {
    if (!result) return;
    const ok = await aiService.copyText(result.narasiEvaluasiGuru);
    if (ok) onNotify?.('Narasi evaluasi rapor berhasil disalin ke clipboard!', 'success');
  };

  const handleExportWord = () => {
    if (!result) return;
    const html = `
      <h1 style="text-align: center; color: #047857; margin-bottom: 2pt;">LAPORAN ANALISIS HASIL ASESMEN & TINDAK LANJUT</h1>
      <p style="text-align: center; font-size: 11pt; color: #64748b;">MI Ma'arif Al Ihsan Soborejo - Kurikulum Merdeka</p>
      <br/>

      <table style="width: 100%; border: 1px solid #94a3b8; margin-bottom: 12pt;">
        <tr><td style="width: 25%;"><b>Mata Pelajaran</b></td><td>${formData.subject}</td><td style="width: 25%;"><b>Fase / Kelas</b></td><td>${formData.grade}</td></tr>
        <tr><td><b>Lingkup Materi</b></td><td>${formData.topic}</td><td><b>Kriteria KKTP</b></td><td>${formData.kktp}</td></tr>
        <tr><td><b>Jumlah Siswa</b></td><td>${formData.totalStudents} Siswa</td><td><b>Ketuntasan Klasikal</b></td><td>${formData.passCount} Tuntas / ${formData.remedialCount} Remedial (${formData.passPercentage}%)</td></tr>
        <tr><td><b>Nilai Rata-rata</b></td><td>${formData.averageScore}</td><td><b>Rentang Nilai</b></td><td>Terendah: ${formData.lowestScore} | Tertinggi: ${formData.highestScore}</td></tr>
      </table>

      <h3>A. INTERPRETASI KUALITATIF HASIL BELAJAR</h3>
      <p style="line-height: 1.6;">${result.interpretasiKualitatif}</p>

      <h3>B. TUJUAN PEMBELAJARAN YANG BELUM TERCAPAI</h3>
      <ul>${result.analisisTujuanBelumTercapai.map((tp) => `<li>${tp}</li>`).join('')}</ul>

      <h3>C. PROGRAM TINDAK LANJUT REMEDIAL (SISWA BELUM TUNTAS)</h3>
      ${result.rekomendasiRemedial.map((rem) => `
        <div style="margin-bottom: 8pt; padding: 8pt; background: #fff1f2; border-left: 3pt solid #e11d48;">
          <b>${rem.kelompokSiswa}</b><br/>
          <b>Aktivitas:</b> ${rem.kegiatan}<br/>
          <b>Metode:</b> ${rem.metode}
        </div>
      `).join('')}

      <h3>D. PROGRAM PENGAYAAN (SISWA MAHIR)</h3>
      ${result.rekomendasiPengayaan.map((peng) => `
        <div style="margin-bottom: 8pt; padding: 8pt; background: #f0fdf4; border-left: 3pt solid #059669;">
          <b>${peng.kelompokSiswa}</b><br/>
          <b>Aktivitas Tantangan:</b> ${peng.kegiatanTantangan}
        </div>
      `).join('')}

      <h3>E. NARASI EVALUASI PEMBELAJARAN UNTUK BUKU RAPOR / WALI KELAS</h3>
      <div style="background-color: #f8fafc; border: 1pt solid #cbd5e1; padding: 10pt; font-style: italic;">
        "${result.narasiEvaluasiGuru}"
      </div>
    `;

    aiService.exportToWord(
      `Analisis_Nilai_${formData.subject}_${formData.grade}`,
      `Laporan Analisis Hasil Belajar ${formData.subject}`,
      html
    );
    onNotify?.('Laporan analisis nilai diekspor ke Microsoft Word (.doc)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Analisis Hasil Belajar & Tindak Lanjut</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Analisis Statistik Capaian Asesmen, Program Remedial, & Narasi Rapor
        </h2>
        <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
          Menghubungkan data nilai statistik riil di aplikasi dengan interpretasi kualitatif cerdas. AI tidak mengarang angka statistik, melainkan merumuskan program remedial terarah dan ide pengayaan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Data Statistik Asesmen Riil</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mata Pelajaran</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="IPAS">IPAS</option>
                  <option value="Matematika">Matematika</option>
                  <option value="Pendidikan Pancasila">Pendidikan Pancasila</option>
                  <option value="Al-Qur’an Hadis">Al-Qur’an Hadis</option>
                  <option value="Akidah Akhlak">Akidah Akhlak</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fase / Kelas</label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="Kelas 1">Kelas 1</option>
                  <option value="Kelas 2">Kelas 2</option>
                  <option value="Kelas 3">Kelas 3</option>
                  <option value="Kelas 4">Kelas 4</option>
                  <option value="Kelas 5">Kelas 5</option>
                  <option value="Kelas 6">Kelas 6</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Lingkup Materi / Asesmen</label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>

            {/* Stat Matrix */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Ambang KKTP</label>
                <input
                  type="number"
                  value={formData.kktp}
                  onChange={(e) => handleStatChange('kktp', Number(e.target.value))}
                  className="w-full font-bold text-slate-800 border border-slate-300 rounded p-1 bg-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Total Siswa</label>
                <input
                  type="number"
                  value={formData.totalStudents}
                  onChange={(e) => handleStatChange('totalStudents', Number(e.target.value))}
                  className="w-full font-bold text-slate-800 border border-slate-300 rounded p-1 bg-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Rata-Rata Nilai</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.averageScore}
                  onChange={(e) => handleStatChange('averageScore', Number(e.target.value))}
                  className="w-full font-bold text-emerald-700 border border-slate-300 rounded p-1 bg-white text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Siswa Tuntas</label>
                <input
                  type="number"
                  value={formData.passCount}
                  onChange={(e) => handleStatChange('passCount', Number(e.target.value))}
                  className="w-full font-bold text-emerald-800 border border-slate-300 rounded p-1 bg-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Butuh Remedial</label>
                <div className="w-full font-bold text-rose-700 p-1 bg-rose-50 border border-rose-200 rounded text-xs text-center">
                  {formData.remedialCount}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Ketuntasan (%)</label>
                <div className="w-full font-bold text-slate-800 p-1 bg-slate-200/60 rounded text-xs text-center">
                  {formData.passPercentage}%
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Nilai Terendah</label>
                <input
                  type="number"
                  value={formData.lowestScore}
                  onChange={(e) => handleStatChange('lowestScore', Number(e.target.value))}
                  className="w-full font-bold text-rose-600 border border-slate-300 rounded p-1 bg-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block">Nilai Tertinggi</label>
                <input
                  type="number"
                  value={formData.highestScore}
                  onChange={(e) => handleStatChange('highestScore', Number(e.target.value))}
                  className="w-full font-bold text-emerald-600 border border-slate-300 rounded p-1 bg-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Tujuan Pembelajaran (TP) yang Perlu Penguatan:
              </label>
              <textarea
                rows={2}
                value={formData.unachievedObjectives.join('\n')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    unachievedObjectives: e.target.value.split('\n').filter(Boolean),
                  })
                }
                className="w-full border border-slate-300 rounded-lg p-2 leading-relaxed"
                placeholder="Tuliskan 1 TP per baris..."
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
                  <span>Gemini AI Sedang Menganalisis Pola Capaian...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Analisis Hasil & Rumuskan Remedial</span>
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
                {result ? 'Interpretasi Kualitatif & Program Tindak Lanjut' : 'Pratinjau Analisis Nilai'}
              </span>

              {result && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={handleCopyNarrative}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1 font-semibold"
                    title="Salin Narasi Evaluasi"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Narasi</span>
                  </button>

                  <button
                    onClick={handleExportWord}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-1 hover:bg-blue-700 shadow-xs"
                    title="Ekspor ke Word"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h4 className="text-sm font-bold text-slate-700">Menganalisis Ketercapaian Hasil Belajar</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Menghubungkan angka ketuntasan siswa dengan formulasi intervensi pedagogik, klinik remedial, dan narasi rapor deskriptif...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <TrendingUp className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada Analisis Dihasilkan</h4>
                <p className="text-xs max-w-xs mt-1">
                  Masukkan data nilai capaian siswa pada formulir kiri lalu klik tombol untuk melihat rekomendasi tindak lanjut.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                {/* Status Capaian Badge */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div>
                    <span className="text-[11px] text-emerald-800 block">Status Ketuntasan Klasikal:</span>
                    <span className="text-sm font-extrabold text-emerald-950">
                      {result.ringkasanStatistik.statusKelas} ({result.ringkasanStatistik.persentaseTuntas}%)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">Rata-rata Kelas:</span>
                    <span className="text-sm font-extrabold text-slate-800">
                      {result.ringkasanStatistik.rataRata} / 100
                    </span>
                  </div>
                </div>

                {/* Interpretasi Kualitatif */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <span className="font-bold text-slate-800 block text-xs">
                    A. Interpretasi Kualitatif Ketercapaian Kompetensi:
                  </span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">{result.interpretasiKualitatif}</p>
                </div>

                {/* TP yang Belum Tuntas */}
                <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-3.5 space-y-1.5">
                  <span className="font-bold text-rose-900 block text-xs">
                    B. Analisis Letak Kesulitan (TP Belum Tuntas):
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                    {result.analisisTujuanBelumTercapai.map((tp, idx) => (
                      <li key={idx}>{tp}</li>
                    ))}
                  </ul>
                </div>

                {/* Rekomendasi Remedial & Pengayaan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-rose-200 rounded-xl p-3 space-y-2 bg-rose-50/20">
                    <span className="font-bold text-rose-900 block text-xs">
                      C. Program Remedial Terarah:
                    </span>
                    {result.rekomendasiRemedial.map((rem, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-rose-200 text-[11px] space-y-1">
                        <span className="font-bold text-rose-800 block">{rem.kelompokSiswa}</span>
                        <p className="text-slate-700"><b className="text-slate-600">Aktivitas:</b> {rem.kegiatan}</p>
                        <p className="text-slate-600"><b className="text-slate-700">Metode:</b> {rem.metode}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border border-emerald-200 rounded-xl p-3 space-y-2 bg-emerald-50/20">
                    <span className="font-bold text-emerald-900 block text-xs">
                      D. Program Pengayaan (Mahir):
                    </span>
                    {result.rekomendasiPengayaan.map((peng, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-emerald-200 text-[11px] space-y-1">
                        <span className="font-bold text-emerald-800 block">{peng.kelompokSiswa}</span>
                        <p className="text-slate-700"><b className="text-slate-600">Tantangan:</b> {peng.kegiatanTantangan}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Narasi Evaluasi Guru */}
                <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 text-xs">
                      E. Narasi Evaluasi Resmi (Rapor / Laporan Madrasah):
                    </span>
                    <button
                      onClick={handleCopyNarrative}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin Narasi</span>
                    </button>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-[11px] bg-white p-3 rounded-lg border border-indigo-100 italic">
                    "{result.narasiEvaluasiGuru}"
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
