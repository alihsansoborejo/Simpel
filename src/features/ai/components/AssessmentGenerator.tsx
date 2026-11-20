import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  Copy,
  Download,
  Printer,
  Save,
  RefreshCw,
  CheckCircle2,
  ListOrdered,
  FileSpreadsheet,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AssessmentQuestionRequest, AssessmentQuestionResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AssessmentGenerator: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswerKeys, setShowAnswerKeys] = useState(true);
  const [result, setResult] = useState<AssessmentQuestionResult | null>(null);

  const [formData, setFormData] = useState<AssessmentQuestionRequest>({
    subject: 'Bahasa Indonesia',
    grade: 'Kelas 4',
    topic: 'Teks Narasi, Kalimat Transitif, dan Pesan Moral Cerita',
    learningObjective: 'Peserta didik mampu menganalisis gagasan pokok, kaidah kebahasaan kalimat transitif, dan merefleksikan nilai moral cerita.',
    questionTypes: ['pg', 'menjodohkan', 'isian', 'uraian', 'hots'],
    questionCount: 5,
    difficulty: 'sedang',
    includeGrid: true,
    includeRubric: true,
  });

  const handleToggleQuestionType = (type: any) => {
    if (formData.questionTypes.includes(type)) {
      if (formData.questionTypes.length > 1) {
        setFormData({
          ...formData,
          questionTypes: formData.questionTypes.filter((t) => t !== type),
        });
      }
    } else {
      setFormData({
        ...formData,
        questionTypes: [...formData.questionTypes, type],
      });
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const res = await aiService.generateAssessment(formData);
      setResult(res);

      await aiService.logUsage({
        userId: user?.id || 'guru-anon',
        userName: user?.profile?.full_name || 'Guru MI Al Ihsan',
        userRole: activeRole || 'guru',
        featureType: 'soal_asesmen',
        promptSummary: `Asesmen: ${formData.subject} - ${formData.topic} (${formData.questionCount} Butir Soal)`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.('Kisi-kisi dan Butir Soal Asesmen berhasil disusun!', 'success');
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal menyusun soal asesmen.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!result) return;
    aiService.saveDraft({
      title: result.judulAsesmen,
      featureType: 'soal_asesmen',
      subject: formData.subject,
      grade: formData.grade,
      academicYear: '2024/2025',
      semester: 'Ganjil',
      content: result,
      status: 'draft',
    });
    onNotify?.('Instrumen asesmen disimpan sebagai Draf lokal.', 'success');
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `
INSTRUMEN ASESMEN & SOAL KURIKULUM MERDEKA
MI MA'ARIF AL IHSAN SOBOREJO
${result.judulAsesmen}
Mata Pelajaran: ${result.mataPelajaran} | Kelas: ${result.faseKelas}

I. KISI-KISI SOAL
${result.kisiKisi.map((k) => `No ${k.nomor}. TP: ${k.tp} | Materi: ${k.materi} | Indikator: ${k.indikator} | Level: ${k.levelKognitif} | Bentuk: ${k.bentukSoal}`).join('\n')}

II. DAFTAR BUTIR SOAL
${result.daftarSoal.map((q) => `
Soal No. ${q.nomor} [${q.bentuk}] (Skor: ${q.bobotSkor})
${q.stimulus ? `Stimulus: ${q.stimulus}\n` : ''}Pertanyaan: ${q.pertanyaan}
${q.pilihan ? q.pilihan.join('\n') : ''}
Kunci Jawaban: ${q.kunciJawaban}
Pembahasan: ${q.pembahasan}
`).join('\n-------------------------\n')}

III. PEDOMAN PENSKORAN
Rumus: ${result.pedomanPenskoran.rumusNilai}
${result.pedomanPenskoran.rubrik.map((r) => `- ${r.kriteria}: ${r.skor}`).join('\n')}
    `.trim();

    const ok = await aiService.copyText(text);
    if (ok) onNotify?.('Seluruh instrumen soal berhasil disalin ke clipboard!', 'success');
  };

  const handleExportWord = () => {
    if (!result) return;
    const html = `
      <h1 style="text-align: center; color: #047857; margin-bottom: 2pt;">INSTRUMEN SOAL & KISI-KISI ASESMEN</h1>
      <h2 style="text-align: center; color: #1e293b; font-size: 13pt; margin-top: 0;">${result.judulAsesmen}</h2>
      <p style="text-align: center; font-size: 10pt; color: #64748b;">MI Ma'arif Al Ihsan Soborejo - Kurikulum Merdeka</p>
      <br/>

      <h3>A. KISI-KISI PENULISAN SOAL</h3>
      <table style="width: 100%; border: 1px solid #94a3b8;">
        <tr style="background: #f1f5f9;">
          <th style="width: 5%;">No</th>
          <th>Tujuan Pembelajaran</th>
          <th>Materi</th>
          <th>Indikator Soal</th>
          <th>Level</th>
          <th>Bentuk</th>
        </tr>
        ${result.kisiKisi.map((k) => `
          <tr>
            <td style="text-align: center;">${k.nomor}</td>
            <td>${k.tp}</td>
            <td>${k.materi}</td>
            <td>${k.indikator}</td>
            <td>${k.levelKognitif}</td>
            <td>${k.bentukSoal}</td>
          </tr>
        `).join('')}
      </table>

      <h3>B. NASKAH BUTIR SOAL</h3>
      ${result.daftarSoal.map((q) => `
        <div style="margin-bottom: 14pt; border: 1pt solid #cbd5e1; padding: 10pt; border-radius: 6pt;">
          <p style="margin: 0 0 6pt 0;"><b>Nomor ${q.nomor}. (${q.bentuk}) - Skor: ${q.bobotSkor}</b></p>
          ${q.stimulus ? `<p style="background: #f8fafc; padding: 8pt; border-left: 3pt solid #047857; font-style: italic; margin-bottom: 8pt;">${q.stimulus}</p>` : ''}
          <p style="margin: 0 0 8pt 0;">${q.pertanyaan}</p>
          ${q.pilihan ? `<div style="margin-left: 12pt;">${q.pilihan.map((p) => `<p style="margin: 2pt 0;">${p}</p>`).join('')}</div>` : ''}
          <div style="background-color: #f0fdf4; border-top: 1pt dashed #86efac; padding: 6pt; margin-top: 8pt; font-size: 9pt;">
            <b>Kunci Jawaban:</b> ${q.kunciJawaban}<br/>
            <b>Pembahasan:</b> ${q.pembahasan}
          </div>
        </div>
      `).join('')}

      <h3>C. PEDOMAN PENSKORAN</h3>
      <p><b>Rumus Penilaian:</b> ${result.pedomanPenskoran.rumusNilai}</p>
      <table style="width: 100%; border: 1px solid #94a3b8;">
        <tr style="background: #f1f5f9;"><th>Kriteria Jawaban</th><th>Skor</th></tr>
        ${result.pedomanPenskoran.rubrik.map((r) => `<tr><td>${r.kriteria}</td><td>${r.skor}</td></tr>`).join('')}
      </table>
    `;

    aiService.exportToWord(
      `Asesmen_${formData.subject}_${formData.grade}`,
      `Instrumen Asesmen ${formData.subject}`,
      html
    );
    onNotify?.('Instrumen soal diekspor ke Microsoft Word (.doc)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Pembuat Soal & Asesmen</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Pembuat Soal, Kisi-Kisi, dan Pedoman Penskoran Asesmen
        </h2>
        <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
          Membuat butir soal Pilihan Ganda, Isian, Menjodohkan, Uraian, stimulus literasi-numerasi islami, dan soal HOTS berjenjang lengkap dengan kunci dan rubrik penilaian.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Parameter Asesmen</span>
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
                  <option value="Fikih">Fikih</option>
                  <option value="SKI">SKI</option>
                  <option value="Bahasa Arab">Bahasa Arab</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fase / Kelas</label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="Kelas 1">Kelas 1 (Fase A)</option>
                  <option value="Kelas 2">Kelas 2 (Fase A)</option>
                  <option value="Kelas 3">Kelas 3 (Fase B)</option>
                  <option value="Kelas 4">Kelas 4 (Fase B)</option>
                  <option value="Kelas 5">Kelas 5 (Fase C)</option>
                  <option value="Kelas 6">Kelas 6 (Fase C)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Materi / Lingkup Asesmen</label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
                placeholder="Contoh: Kalimat Transitif dan Unsur Cerita"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tujuan Pembelajaran (TP)</label>
              <textarea
                rows={2}
                value={formData.learningObjective}
                onChange={(e) => setFormData({ ...formData, learningObjective: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 leading-relaxed"
                placeholder="Rumuskan TP yang akan diuji..."
              />
            </div>

            {/* Bentuk Soal Checkbox Multi-Select */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Bentuk Soal yang Dibuat:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'pg', label: 'Pilihan Ganda (PG)' },
                  { id: 'menjodohkan', label: 'Menjodohkan' },
                  { id: 'isian', label: 'Isian Singkat' },
                  { id: 'uraian', label: 'Uraian Bebas' },
                  { id: 'literasi', label: 'Stimulus Literasi' },
                  { id: 'hots', label: 'Soal HOTS Nalar' },
                ].map((type) => {
                  const isChecked = formData.questionTypes.includes(type.id as any);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleToggleQuestionType(type.id)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] text-left transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isChecked ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Jumlah Soal</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.questionCount}
                  onChange={(e) => setFormData({ ...formData, questionCount: Number(e.target.value) || 5 })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tingkat Kesulitan</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="dasar">Dasar (C1 - C2)</option>
                  <option value="sedang">Sedang (C2 - C3)</option>
                  <option value="tinggi_hots">Tinggi / HOTS (C4 - C6)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI Sedang Merumuskan Butir Soal...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Buat Soal & Kisi-Kisi Lengkap</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Area (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-full min-h-[600px]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800">
                {result ? 'Naskah Asesmen & Kunci Jawaban' : 'Pratinjau Instrumen Soal'}
              </span>

              {result && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setShowAnswerKeys(!showAnswerKeys)}
                    className="px-2.5 py-1 rounded-lg border bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center gap-1 font-semibold"
                    title="Sembunyikan/Tampilkan Kunci Jawaban"
                  >
                    {showAnswerKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAnswerKeys ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Salin Naskah & Kisi-kisi"
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

                  <button
                    onClick={() => aiService.exportToPrintPDF('preview-assessment-content')}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Cetak Naskah"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-semibold flex items-center gap-1 hover:bg-slate-900 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h4 className="text-sm font-bold text-slate-700">Merumuskan Kisi-Kisi & Soal HOTS</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Menyusun stimulus cerita islami kontekstual, opsi pilihan distractor yang bermutu, serta rubrik penskoran...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Award className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada Soal Dibuat</h4>
                <p className="text-xs max-w-xs mt-1">
                  Pilih bentuk soal dan klik tombol untuk menghasilkan naskah asesmen beserta kisi-kisi dan kunci jawaban.
                </p>
              </div>
            ) : (
              <div id="preview-assessment-content" className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                <div className="text-center border-b border-slate-200 pb-2">
                  <h3 className="font-extrabold text-sm text-emerald-900">{result.judulAsesmen}</h3>
                  <p className="text-[11px] text-slate-500">
                    Mata Pelajaran: {result.mataPelajaran} ({result.faseKelas})
                  </p>
                </div>

                {/* Kisi-Kisi Tabel */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>A. Matriks Kisi-Kisi Penulisan Soal</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-left">
                          <th className="p-1.5">No</th>
                          <th className="p-1.5">Indikator Soal</th>
                          <th className="p-1.5">Level</th>
                          <th className="p-1.5">Bentuk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.kisiKisi.map((k) => (
                          <tr key={k.nomor} className="hover:bg-slate-50">
                            <td className="p-1.5 font-bold text-slate-600">{k.nomor}</td>
                            <td className="p-1.5 text-slate-700">{k.indikator}</td>
                            <td className="p-1.5 font-mono text-[10px] text-amber-700 font-bold">{k.levelKognitif}</td>
                            <td className="p-1.5 font-semibold text-slate-800">{k.bentukSoal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Butir Soal */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <ListOrdered className="w-3.5 h-3.5 text-emerald-600" />
                    <span>B. Daftar Butir Soal Asesmen</span>
                  </div>

                  <div className="space-y-4">
                    {result.daftarSoal.map((q) => (
                      <div key={q.nomor} className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                              {q.nomor}
                            </span>
                            <span>Bentuk: {q.bentuk}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                            Skor: {q.bobotSkor}
                          </span>
                        </div>

                        {q.stimulus && (
                          <div className="bg-white border-l-3 border-emerald-600 p-2.5 rounded-r-lg text-slate-700 leading-relaxed text-[11px] italic">
                            <b>Stimulus:</b> {q.stimulus}
                          </div>
                        )}

                        <p className="font-medium text-slate-900 text-xs leading-relaxed">{q.pertanyaan}</p>

                        {q.pilihan && q.pilihan.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pl-2 text-xs text-slate-700">
                            {q.pilihan.map((p, idx) => (
                              <div key={idx} className="p-1.5 bg-white rounded border border-slate-200">
                                {p}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Kunci & Pembahasan Toggleable */}
                        {showAnswerKeys && (
                          <div className="mt-2 pt-2 border-t border-dashed border-emerald-300 bg-emerald-50/80 p-2.5 rounded-lg text-[11px] space-y-1">
                            <div className="flex items-center gap-1 text-emerald-900 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Kunci Jawaban: {q.kunciJawaban}</span>
                            </div>
                            <p className="text-slate-600">
                              <b className="text-slate-700">Pembahasan:</b> {q.pembahasan}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pedoman Penskoran */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">C. Pedoman Penskoran & Rumus Nilai</span>
                  <p className="text-slate-700 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200">
                    {result.pedomanPenskoran.rumusNilai}
                  </p>
                  <div className="space-y-1 text-[11px]">
                    {result.pedomanPenskoran.rubrik.map((r, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-600 border-b border-slate-100 py-1">
                        <span>{r.kriteria}</span>
                        <span className="font-bold text-emerald-800">{r.skor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
