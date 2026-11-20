import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  Copy,
  Download,
  Printer,
  Save,
  RefreshCw,
  Edit3,
  Award,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { LKPDRequest, LKPDResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const LKPDGenerator: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [result, setResult] = useState<LKPDResult | null>(null);

  const [formData, setFormData] = useState<LKPDRequest>({
    subject: 'Bahasa Indonesia',
    grade: 'Kelas 4',
    topic: 'Menulis Cerita Pendek Narasi dan Kalimat Transitif',
    learningObjective: 'Peserta didik mampu menyusun 3 paragraf narasi dengan penggunaan kalimat transitif dan tanda baca yang tepat.',
    difficulty: 'menengah',
    activityType: 'Kelompok Kolaboratif (3-4 Siswa)',
  });

  const handleGenerate = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const res = await aiService.generateLKPD(formData);
      setResult(res);
      setIsEditing(false);

      await aiService.logUsage({
        userId: user?.id || 'guru-anon',
        userName: user?.profile?.full_name || 'Guru MI Al Ihsan',
        userRole: activeRole || 'guru',
        featureType: 'lkpd',
        promptSummary: `LKPD: ${formData.subject} - ${formData.topic} (${formData.grade})`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.('Lembar Kerja Peserta Didik (LKPD) berhasil disusun!', 'success');
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal menyusun LKPD.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!result) return;
    aiService.saveDraft({
      title: result.judul,
      featureType: 'lkpd',
      subject: formData.subject,
      grade: formData.grade,
      academicYear: '2024/2025',
      semester: 'Ganjil',
      content: result,
      status: 'draft',
    });
    onNotify?.('LKPD berhasil disimpan sebagai Draf lokal.', 'success');
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `
LEMBAR KERJA PESERTA DIDIK (LKPD)
MI MA'ARIF AL IHSAN SOBOREJO
${result.judul}

Mata Pelajaran: ${result.identitas.mataPelajaran}
Kelas/Fase: ${result.identitas.faseKelas}
Alokasi Waktu: ${result.identitas.alokasiWaktu}
Identitas Siswa/Kelompok: ................................

A. TUJUAN KEGIATAN
${result.tujuanKegiatan.map((t, i) => `${i + 1}. ${t}`).join('\n')}

B. PETUNJUK PENGERJAAN
${result.petunjukPengerjaan.map((p, i) => `${i + 1}. ${p}`).join('\n')}

C. MATERI SINGKAT
${result.materiSingkat}

D. AKTIVITAS BELAJAR
${result.aktivitasSiswa.map((a) => `${a.tahap}:\n${a.kegiatan}`).join('\n\n')}

E. PERTANYAAN / TUGAS
${result.pertanyaanTugas.map((q) => `Soal ${q.nomor} (Skor ${q.skorMaksimal}):\n${q.pertanyaan}\n[Ruang Jawaban: ........................]`).join('\n\n')}

F. LEMBAR REFLEKSI SISWA
${result.lembarRefleksiSiswa}

G. KRITERIA PENILAIAN
${result.kriteriaPenilaian.map((k) => `- ${k.aspek}: ${k.kriteria} (Skor: ${k.skor})`).join('\n')}
    `.trim();

    const ok = await aiService.copyText(text);
    if (ok) onNotify?.('Seluruh teks LKPD berhasil disalin ke clipboard!', 'success');
  };

  const handleExportWord = () => {
    if (!result) return;
    const html = `
      <h1 style="text-align: center; color: #047857; margin-bottom: 2pt;">LEMBAR KERJA PESERTA DIDIK (LKPD)</h1>
      <h2 style="text-align: center; color: #1e293b; font-size: 14pt; margin-top: 0;">${result.judul}</h2>
      <p style="text-align: center; font-size: 10pt; color: #64748b;">Kurikulum Merdeka - MI Ma'arif Al Ihsan Soborejo</p>
      <br/>

      <table style="width: 100%; border: 1px solid #94a3b8; margin-bottom: 12pt;">
        <tr><td style="width: 30%;"><b>Mata Pelajaran</b></td><td>${result.identitas.mataPelajaran}</td><td style="width: 25%;"><b>Fase / Kelas</b></td><td>${result.identitas.faseKelas}</td></tr>
        <tr><td><b>Alokasi Waktu</b></td><td>${result.identitas.alokasiWaktu}</td><td><b>Hari / Tanggal</b></td><td>...................................</td></tr>
        <tr><td><b>Nama / Kelompok</b></td><td colspan="3">...........................................................................................</td></tr>
      </table>

      <h3>A. TUJUAN KEGIATAN</h3>
      <ol>${result.tujuanKegiatan.map((t) => `<li>${t}</li>`).join('')}</ol>

      <h3>B. PETUNJUK BELAJAR</h3>
      <ol>${result.petunjukPengerjaan.map((p) => `<li>${p}</li>`).join('')}</ol>

      <div style="background-color: #f8fafc; border-left: 4pt solid #047857; padding: 10pt; margin: 12pt 0;">
        <h4 style="margin: 0 0 6pt 0; color: #047857;">C. MATERI SINGKAT</h4>
        <p style="margin: 0; line-height: 1.5;">${result.materiSingkat}</p>
      </div>

      <h3>D. LANGKAH-LANGKAH AKTIVITAS</h3>
      ${result.aktivitasSiswa.map((a) => `
        <div style="margin-bottom: 8pt;">
          <b>${a.tahap}</b>
          <p style="margin: 2pt 0 4pt 0;">${a.kegiatan}</p>
        </div>
      `).join('')}

      <h3>E. PERTANYAAN & LEMBAR TUGAS</h3>
      ${result.pertanyaanTugas.map((q) => `
        <div style="margin-bottom: 16pt; border: 1pt solid #cbd5e1; padding: 10pt; border-radius: 6pt;">
          <p style="margin: 0 0 8pt 0;"><b>No. ${q.nomor}</b> (Bobot Skor: ${q.skorMaksimal})<br/>${q.pertanyaan}</p>
          <div style="border: 1pt dashed #94a3b8; min-height: 80pt; padding: 8pt; background-color: #fafafa;">
            <i style="color: #94a3b8; font-size: 9pt;">[Ruang Jawaban Peserta Didik]</i>
          </div>
        </div>
      `).join('')}

      <div style="background-color: #fffbeb; border: 1pt solid #fde68a; padding: 10pt; margin: 16pt 0;">
        <h4 style="margin: 0 0 4pt 0; color: #92400e;">F. LEMBAR REFLEKSI SISWA</h4>
        <p style="margin: 0;">${result.lembarRefleksiSiswa}</p>
        <p style="margin-top: 6pt; font-size: 16pt; text-align: center;">⭐ ⭐ ⭐ ⭐ ⭐</p>
      </div>

      <h3>G. RUBRIK KRITERIA PENILAIAN</h3>
      <table style="width: 100%; border: 1pt solid #94a3b8;">
        <tr style="background: #f1f5f9;"><th>Aspek Penilaian</th><th>Deskripsi Kriteria</th><th style="width: 15%;">Skor Maksimal</th></tr>
        ${result.kriteriaPenilaian.map((k) => `
          <tr><td><b>${k.aspek}</b></td><td>${k.kriteria}</td><td style="text-align: center;">${k.skor}</td></tr>
        `).join('')}
      </table>
    `;

    aiService.exportToWord(
      `LKPD_${formData.subject}_${formData.grade}`,
      `LKPD ${formData.subject}`,
      html
    );
    onNotify?.('LKPD diekspor ke Microsoft Word (.doc)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Pembuat LKPD Terstruktur</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Pembuat Lembar Kerja Peserta Didik (LKPD) Ramah Anak MI
        </h2>
        <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
          Menyusun LKPD siap cetak dengan alur bertahap: rangkuman materi, aktivitas kolaboratif/mandiri, ruang jawaban, refleksi emotikon, dan rubrik penilaian guru.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan LKPD</span>
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
                  <option value="Bahasa Jawa">Bahasa Jawa</option>
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
              <label className="font-semibold text-slate-700 block mb-1">Topik / Materi LKPD</label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
                placeholder="Misal: Kalimat Transitif dan Intransitif"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tujuan Kegiatan Belajar</label>
              <textarea
                rows={2}
                value={formData.learningObjective}
                onChange={(e) => setFormData({ ...formData, learningObjective: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 leading-relaxed"
                placeholder="Tuliskan tujuan yang harus dicapai siswa melalui LKPD ini..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tingkat Kesulitan</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="dasar">Dasar (Pengenalan)</option>
                  <option value="menengah">Menengah (Standar MI)</option>
                  <option value="tantangan_hots">Tantangan (HOTS Kreatif)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bentuk Pengerjaan</label>
                <select
                  value={formData.activityType}
                  onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="Mandiri (Individu)">Mandiri (Individu)</option>
                  <option value="Berpasangan (2 Siswa)">Berpasangan (2 Siswa)</option>
                  <option value="Kelompok Kolaboratif (3-4 Siswa)">Kelompok (3-4 Siswa)</option>
                  <option value="Proyek Mini Lingkungan">Proyek Mini Lingkungan</option>
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
                  <span>Gemini AI Sedang Merancang LKPD...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Buat Lembar Kerja Siswa (LKPD)</span>
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
                {result ? 'Dokumen LKPD Siswa (Siap Cetak & Digandakan)' : 'Pratinjau Lembar Kerja'}
              </span>

              {result && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-2.5 py-1 rounded-lg border bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Selesai Edit' : 'Edit Lembar'}</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Salin Teks Lengkap"
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
                    onClick={() => aiService.exportToPrintPDF('preview-lkpd-content')}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Cetak Dokumen"
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
                <h4 className="text-sm font-bold text-slate-700">Menyusun LKPD Edukatif & Menyenangkan</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Menyesuaikan instruksi pengerjaan, stimulus materi sederhana, ruang pengerjaan, dan rubrik penilaian...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada LKPD Dibuat</h4>
                <p className="text-xs max-w-xs mt-1">
                  Tentukan topik dan tingkat kesulitan di panel kiri, kemudian klik tombol untuk membuat LKPD baru.
                </p>
              </div>
            ) : (
              <div id="preview-lkpd-content" className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                {/* Judul & Header Identitas */}
                <div className="text-center border-b-2 border-emerald-700 pb-3">
                  <h3 className="font-extrabold text-sm text-emerald-900">{result.judul}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">MI Ma’arif Al Ihsan Soborejo - Kurikulum Merdeka</p>

                  <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Mata Pelajaran:</span>
                      <span className="font-bold text-slate-800">{result.identitas.mataPelajaran} ({result.identitas.faseKelas})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Alokasi Waktu:</span>
                      <span className="font-bold text-slate-800">{result.identitas.alokasiWaktu}</span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200">
                      <span className="text-slate-500 block">{result.identitas.kelompokAtauNama}</span>
                      <div className="h-6 border-b border-dashed border-slate-300 mt-1" />
                    </div>
                  </div>
                </div>

                {/* Tujuan & Petunjuk */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3">
                    <span className="font-bold text-emerald-900 block mb-1">A. Tujuan Kegiatan:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
                      {result.tujuanKegiatan.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                    <span className="font-bold text-amber-900 block mb-1">B. Petunjuk Pengerjaan:</span>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-700 text-[11px]">
                      {result.petunjukPengerjaan.map((p, i) => <li key={i}>{p}</li>)}
                    </ol>
                  </div>
                </div>

                {/* Materi Singkat */}
                <div className="bg-slate-50 border-l-3 border-emerald-600 p-3 rounded-r-lg">
                  <span className="font-bold text-emerald-800 block mb-1">C. Rangkuman Materi Singkat:</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">{result.materiSingkat}</p>
                </div>

                {/* Aktivitas Siswa */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">D. Langkah Aktivitas Peserta Didik:</span>
                  <div className="space-y-2">
                    {result.aktivitasSiswa.map((a, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                        <span className="font-bold text-emerald-800 block mb-0.5">{a.tahap}</span>
                        <p className="text-slate-700">{a.kegiatan}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pertanyaan / Tugas */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <span className="font-bold text-slate-800 block text-xs">E. Pertanyaan & Ruang Jawaban Siswa:</span>
                  <div className="space-y-3">
                    {result.pertanyaanTugas.map((q) => (
                      <div key={q.nomor} className="border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between font-semibold text-slate-800 text-xs">
                          <span>{q.nomor}. {q.pertanyaan}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Skor: {q.skorMaksimal}
                          </span>
                        </div>
                        <div className="min-h-16 border border-dashed border-slate-300 rounded-md bg-slate-50/50 p-2 text-slate-400 italic text-[11px]">
                          Ruang jawaban siswa...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refleksi & Kriteria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-center">
                    <span className="font-bold text-amber-900 block text-xs mb-1">Refleksi Belajar Siswa:</span>
                    <p className="text-slate-700 text-[11px] mb-2">{result.lembarRefleksiSiswa}</p>
                    <div className="flex justify-center gap-1.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-5 h-5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kriteria Penilaian:</span>
                    </span>
                    <div className="space-y-1 text-[11px]">
                      {result.kriteriaPenilaian.map((k, i) => (
                        <div key={i} className="flex justify-between items-center text-slate-700">
                          <span>{k.aspek}: {k.kriteria}</span>
                          <span className="font-bold text-emerald-700">{k.skor} Poin</span>
                        </div>
                      ))}
                    </div>
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
