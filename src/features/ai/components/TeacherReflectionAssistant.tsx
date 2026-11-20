import React, { useState } from 'react';
import {
  Sparkles,
  Heart,
  Copy,
  Download,
  Save,
  RefreshCw,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { TeacherReflectionRequest, TeacherReflectionResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const TeacherReflectionAssistant: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TeacherReflectionResult | null>(null);

  const [formData, setFormData] = useState<TeacherReflectionRequest>({
    subject: 'Matematika',
    grade: 'Kelas 4',
    topic: 'Pecahan Senilai dan Operasi Hitung Sederhana',
    journalNotes:
      'Ketika menjelaskan pecahan senilai menggunakan rumus abstrak di papan tulis, sekitar 7 dari 24 siswa tampak melamun dan bingung. Saat latihan mandiri, suasana kelas menjadi gaduh karena siswa yang belum paham saling bertanya dan sebagian merasa frustrasi.',
    studentResponse:
      'Siswa laki-laki cenderung cepat menyerah dan mengalihkan perhatian dengan bercanda, sedangkan beberapa siswi tampak cemas saat dipanggil ke depan kelas.',
  });

  const handleGenerate = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const res = await aiService.generateTeacherReflection(formData);
      setResult(res);

      await aiService.logUsage({
        userId: user?.id || 'guru-anon',
        userName: user?.profile?.full_name || 'Guru MI Al Ihsan',
        userRole: activeRole || 'guru',
        featureType: 'refleksi_guru',
        promptSummary: `Refleksi Guru: ${formData.subject} - ${formData.topic}`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.('Analisis refleksi dan rencana perbaikan KBM berhasil disusun!', 'success');
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal memproses refleksi mengajar.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `
ANALISIS REFLEKSI GURU & RENCANA PERBAIKAN PEMBELAJARAN
MI MA'ARIF AL IHSAN SOBOREJO
Mata Pelajaran: ${formData.subject} | Kelas: ${formData.grade} | Topik: ${formData.topic}

I. RINGKASAN PEMBELAJARAN
${result.ringkasanKbm}

II. IDENTIFIKASI KENDALA & PENYEBAB
Kendala:
${result.identifikasiKendala.map((k) => `- ${k}`).join('\n')}

Kemungkinan Penyebab:
${result.analisisPenyebab.map((p) => `- ${p}`).join('\n')}

III. ALTERNATIF SOLUSI PEDAGOGIK
${result.alternatifSolusi.map((s) => `[${s.area}]: ${s.rekomendasi}`).join('\n\n')}

IV. RENCANA PERBAIKAN (ACTION PLAN)
${result.rencanaPerbaikan.map((r, i) => `${i + 1}. Langkah: ${r.langkah}\n   Target: ${r.waktuTarget}\n   Indikator: ${r.indikatorKeberhasilan}`).join('\n\n')}

V. REKOMENDASI PENDEKATAN CINTA (KBC)
${result.rekomendasiPendekatanCinta}
    `.trim();

    const ok = await aiService.copyText(text);
    if (ok) onNotify?.('Hasil refleksi berhasil disalin ke clipboard!', 'success');
  };

  const handleExportWord = () => {
    if (!result) return;
    const html = `
      <h1 style="text-align: center; color: #047857; margin-bottom: 2pt;">CATATAN REFLEKSI & RENCANA TINDAK LANJUT GURU</h1>
      <p style="text-align: center; font-size: 11pt; color: #64748b;">Kurikulum Berbasis Cinta & Supervisi Mandiri - MI Ma'arif Al Ihsan Soborejo</p>
      <br/>

      <table style="width: 100%; border: 1px solid #94a3b8; margin-bottom: 12pt;">
        <tr><td style="width: 25%;"><b>Mata Pelajaran</b></td><td>${formData.subject}</td><td style="width: 25%;"><b>Fase / Kelas</b></td><td>${formData.grade}</td></tr>
        <tr><td><b>Topik KBM</b></td><td>${formData.topic}</td><td><b>Tanggal Refleksi</b></td><td>${new Date().toLocaleDateString('id-ID')}</td></tr>
      </table>

      <h3>A. RINGKASAN PELAKSANAAN KBM</h3>
      <p>${result.ringkasanKbm}</p>

      <h3>B. IDENTIFIKASI KENDALA & AKAR MASALAH</h3>
      <p><b>Kendala yang Ditemukan:</b></p>
      <ul>${result.identifikasiKendala.map((k) => `<li>${k}</li>`).join('')}</ul>
      <p><b>Analisis Akar Penyebab:</b></p>
      <ul>${result.analisisPenyebab.map((p) => `<li>${p}</li>`).join('')}</ul>

      <h3>C. ALTERNATIF SOLUSI & DIFERENSIASI</h3>
      ${result.alternatifSolusi.map((s) => `
        <div style="margin-bottom: 8pt; padding: 8pt; background: #f8fafc; border-left: 3pt solid #047857;">
          <b>${s.area}</b><br/>${s.rekomendasi}
        </div>
      `).join('')}

      <h3>D. RENCANA PERBAIKAN PEMBELAJARAN (ACTION PLAN)</h3>
      <table style="width: 100%; border: 1px solid #94a3b8;">
        <tr style="background: #f1f5f9;"><th>Langkah Perbaikan</th><th style="width: 25%;">Waktu Target</th><th>Indikator Keberhasilan</th></tr>
        ${result.rencanaPerbaikan.map((r) => `
          <tr><td>${r.langkah}</td><td>${r.waktuTarget}</td><td>${r.indikatorKeberhasilan}</td></tr>
        `).join('')}
      </table>

      <div style="background-color: #f0fdf4; border: 1pt solid #86efac; padding: 10pt; margin-top: 14pt;">
        <h4 style="margin: 0 0 4pt 0; color: #047857;">E. PENGUATAN PENDEKATAN CINTA & KASIH SAYANG</h4>
        <p style="margin: 0; line-height: 1.5;">${result.rekomendasiPendekatanCinta}</p>
      </div>
    `;

    aiService.exportToWord(
      `Refleksi_Guru_${formData.subject}_${formData.grade}`,
      `Refleksi Mengajar ${formData.subject}`,
      html
    );
    onNotify?.('Laporan refleksi diekspor ke Microsoft Word (.doc)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Asisten Refleksi Guru & Jurnal KBM</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Asisten Refleksi Mengajar, Diagnosis Kendala, & Solusi Berbasis Cinta
        </h2>
        <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
          Membantu Bapak/Ibu Guru mendiagnosis dinamika kelas secara mendalam tanpa rasa dihakimi, merumuskan rencana perbaikan pembelajaran, serta memperkaya empati kepada peserta didik.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-600" />
              <span>Catatan Pengamatan Guru</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mata Pelajaran</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="Matematika">Matematika</option>
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="IPAS">IPAS</option>
                  <option value="Pendidikan Pancasila">Pendidikan Pancasila</option>
                  <option value="Al-Qur’an Hadis">Al-Qur’an Hadis</option>
                  <option value="Akidah Akhlak">Akidah Akhlak</option>
                  <option value="Fikih">Fikih</option>
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
              <label className="font-semibold text-slate-700 block mb-1">Topik Pembelajaran Saat Itu</label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
                placeholder="Topik atau materi yang diajarkan"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Catatan Kejadian di Kelas / Kendala yang Dirasakan:
              </label>
              <textarea
                rows={4}
                value={formData.journalNotes}
                onChange={(e) => setFormData({ ...formData, journalNotes: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 leading-relaxed"
                placeholder="Ceritakan apa yang terjadi saat KBM berlangsung..."
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Respon dan Kondisi Emosional Siswa:
              </label>
              <textarea
                rows={3}
                value={formData.studentResponse}
                onChange={(e) => setFormData({ ...formData, studentResponse: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 leading-relaxed"
                placeholder="Bagaimana respon, antusiasme, atau kendala anak-anak..."
              />
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 leading-tight">
              <b>Catatan Keamanan & Privasi:</b> AI tidak akan mengubah atau menimpa catatan jurnal asli Anda tanpa persetujuan manual. Data refleksi dianalisis secara objektif.
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI Sedang Menganalisis Refleksi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Analisis Refleksi & Cari Solusi</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Hasil (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-full min-h-[600px]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800">
                {result ? 'Hasil Analisis Pedagogik & Solusi Reflektif' : 'Pratinjau Hasil Refleksi'}
              </span>

              {result && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Salin Teks"
                  >
                    <Copy className="w-3.5 h-3.5" />
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
                <h4 className="text-sm font-bold text-slate-700">Menganalisis Dinamika Kelas</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Mendiagnosis kendala kesiapan belajar anak, menyusun alternatif media manipulatif, dan formulasi Kurikulum Berbasis Cinta...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Compass className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada Refleksi Dianalisis</h4>
                <p className="text-xs max-w-xs mt-1">
                  Masukkan catatan pengalaman mengajar Anda di formulir kiri untuk menemukan solusi perbaikan yang solutif.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                {/* Ringkasan */}
                <div className="bg-slate-50 border-l-3 border-emerald-600 p-3.5 rounded-r-lg">
                  <span className="font-bold text-emerald-900 block mb-1">Ringkasan Pelaksanaan KBM:</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">{result.ringkasanKbm}</p>
                </div>

                {/* Kendala & Penyebab */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 space-y-1.5">
                    <span className="font-bold text-rose-900 flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Identifikasi Kendala:</span>
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                      {result.identifikasiKendala.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                      <Compass className="w-3.5 h-3.5 text-amber-600" />
                      <span>Akar Penyebab:</span>
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                      {result.analisisPenyebab.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Alternatif Solusi */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">Alternatif Solusi & Diferensiasi:</span>
                  <div className="space-y-2">
                    {result.alternatifSolusi.map((s, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                        <span className="font-bold text-emerald-800 block mb-0.5">{s.area}</span>
                        <p className="text-slate-700">{s.rekomendasi}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Plan */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">Rencana Perbaikan Pembelajaran (Action Plan):</span>
                  <div className="space-y-2">
                    {result.rencanaPerbaikan.map((r, idx) => (
                      <div key={idx} className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-200 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="text-emerald-900">{idx + 1}. {r.langkah}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                            {r.waktuTarget}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          <b className="text-slate-700">Indikator Sukses:</b> {r.indikatorKeberhasilan}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pendekatan Cinta */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>Rekomendasi Sentuhan Kurikulum Berbasis Cinta (KBC):</span>
                  </span>
                  <p className="text-slate-700 leading-relaxed text-[11px] italic bg-white p-2.5 rounded-lg border border-emerald-100">
                    "{result.rekomendasiPendekatanCinta}"
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
