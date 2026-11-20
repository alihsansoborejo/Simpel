import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Copy,
  Download,
  Printer,
  FileCheck2,
  RefreshCw,
  Save,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Heart,
  ChevronDown,
  Layers,
  Edit3,
} from 'lucide-react';
import { ModulAjarRequest, ModulAjarResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ModulAjarGenerator: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSectionToRegen, setSelectedSectionToRegen] = useState<string>('');
  const [result, setResult] = useState<ModulAjarResult | null>(null);

  // Form State
  const [formData, setFormData] = useState<ModulAjarRequest>({
    subject: 'Bahasa Indonesia',
    grade: 'Kelas 4',
    semester: 'Ganjil',
    academicYear: '2024/2025',
    topic: 'Teks Narasi dan Kalimat Transitif-Intransitif',
    cp: 'Peserta didik mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi anak dalam bentuk cetak atau elektronik.',
    tp: 'Peserta didik mampu mengidentifikasi unsur intrinsik cerita narasi dan membedakan kalimat transitif serta intransitif dengan tepat.',
    timeAllocation: '2 x 35 Menit (1 Pertemuan)',
    studentCharacteristics: 'Siswa aktif, dominan gaya belajar visual dan kinestetik, senang berkolaborasi dalam kelompok kecil.',
    deepLearningApproach: 'Mindful (Sadar Penuh & Reflektif), Meaningful (Bermakna Kontekstual Soborejo), Joyful (Gembira & Eksploratif)',
    cintaValues: 'Kasih Sayang, Keteladanan, Keberagaman & Inklusif, Adab & Akhlak Mulia',
  });

  const handleGenerate = async (sectionToRegen?: string) => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const payload: ModulAjarRequest = {
        ...formData,
        regenerateSection: sectionToRegen || undefined,
      };
      const res = await aiService.generateModulAjar(payload);
      setResult(res);
      setIsEditing(false);

      // Catat log AI
      await aiService.logUsage({
        userId: user?.id || 'guru-anon',
        userName: user?.profile?.full_name || 'Guru MI Al Ihsan',
        userRole: activeRole || 'guru',
        featureType: 'modul_ajar',
        promptSummary: `Modul Ajar: ${formData.subject} - ${formData.topic} (${formData.grade})`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.(
        sectionToRegen
          ? `Bagian "${sectionToRegen}" berhasil diregenerasi!`
          : 'Draf Modul Ajar berhasil disusun oleh AI Gemini!',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal menyusun Modul Ajar. Silakan coba kembali.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!result) return;
    aiService.saveDraft({
      title: `Modul Ajar ${formData.subject} - ${formData.topic} (${formData.grade})`,
      featureType: 'modul_ajar',
      subject: formData.subject,
      grade: formData.grade,
      academicYear: formData.academicYear,
      semester: formData.semester,
      content: result,
      status: 'draft',
    });
    onNotify?.('Modul Ajar berhasil disimpan sebagai Draf.', 'success');
  };

  const handleSubmitForReview = () => {
    if (!result) return;
    const draft = aiService.saveDraft({
      title: `Modul Ajar ${formData.subject} - ${formData.topic} (${formData.grade})`,
      featureType: 'modul_ajar',
      subject: formData.subject,
      grade: formData.grade,
      academicYear: formData.academicYear,
      semester: formData.semester,
      content: result,
      status: 'diajukan',
    });
    onNotify?.(
      'Modul Ajar telah diajukan ke Kepala Madrasah untuk telaah dan pengesahan.',
      'success'
    );
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `
MODUL AJAR KURIKULUM MERDEKA
MI MA'ARIF AL IHSAN SOBOREJO
T.A. ${result.identitas.tahunAjaran} - Semester ${result.identitas.semester}

I. IDENTITAS MODUL
- Mata Pelajaran: ${result.identitas.mataPelajaran}
- Kelas/Fase: ${result.identitas.faseKelas}
- Materi Pokok: ${result.identitas.materiPokok}
- Alokasi Waktu: ${result.identitas.alokasiWaktu}

II. TUJUAN PEMBELAJARAN
${result.tujuanPembelajaran.map((tp, i) => `${i + 1}. ${tp}`).join('\n')}

III. PEMAHAMAN BERMAKNA
${result.pemahamanBermakna}

IV. PERTANYAAN PEMANTIK
${result.pertanyaanPemantik.map((q, i) => `${i + 1}. ${q}`).join('\n')}

V. KEGIATAN PEMBELAJARAN (DEEP LEARNING & KURIKULUM BERBASIS CINTA)
A. Pendahuluan (${result.kegiatanPembelajaran.pendahuluan.durasi})
${result.kegiatanPembelajaran.pendahuluan.langkah.map((l) => `- ${l}`).join('\n')}

B. Kegiatan Inti (${result.kegiatanPembelajaran.inti.durasi})
1. Mindful Learning (Sadar Penuh):
${result.kegiatanPembelajaran.inti.mindfulLearning.map((l) => `  * ${l}`).join('\n')}
2. Meaningful Learning (Bermakna Kontekstual):
${result.kegiatanPembelajaran.inti.meaningfulLearning.map((l) => `  * ${l}`).join('\n')}
3. Joyful Learning (Gembira & Menyenangkan):
${result.kegiatanPembelajaran.inti.joyfulLearning.map((l) => `  * ${l}`).join('\n')}

C. Penutup (${result.kegiatanPembelajaran.penutup.durasi})
${result.kegiatanPembelajaran.penutup.langkah.map((l) => `- ${l}`).join('\n')}

VI. ASESMEN PEMBELAJARAN
- Diagnostik: ${result.asesmen.diagnostik}
- Formatif: ${result.asesmen.formatif}
- Sumatif: ${result.asesmen.sumatif}
- Rubrik: ${result.asesmen.rubrik}

VII. DIFERENSIASI PEMBELAJARAN
- Konten: ${result.diferensiasi.konten}
- Proses: ${result.diferensiasi.proses}
- Produk: ${result.diferensiasi.produk}

VIII. MEDIA & SUMBER BELAJAR
${result.mediaSumber.map((m) => `- ${m}`).join('\n')}
    `.trim();

    const ok = await aiService.copyText(text);
    if (ok) onNotify?.('Seluruh teks Modul Ajar disalin ke clipboard!', 'success');
  };

  const handleExportWord = () => {
    if (!result) return;
    const html = `
      <h1 style="text-align: center; color: #047857;">MODUL AJAR KURIKULUM MERDEKA</h1>
      <p style="text-align: center; font-style: italic; margin-top: -6px;">Pendekatan Pembelajaran Mendalam (Deep Learning) & Kurikulum Berbasis Cinta</p>
      <br/>

      <table style="width: 100%; border: 1px solid #cbd5e1;">
        <tr style="background-color: #f8fafc;"><th colspan="2" style="padding: 8px; color: #047857;">A. IDENTITAS MODUL</th></tr>
        <tr><td style="width: 35%; padding: 6px;"><b>Nama Madrasah</b></td><td>${result.identitas.madrasah}</td></tr>
        <tr><td style="padding: 6px;"><b>Mata Pelajaran</b></td><td>${result.identitas.mataPelajaran}</td></tr>
        <tr><td style="padding: 6px;"><b>Fase / Kelas</b></td><td>${result.identitas.faseKelas}</td></tr>
        <tr><td style="padding: 6px;"><b>Tahun Ajaran / Semester</b></td><td>${result.identitas.tahunAjaran} / ${result.identitas.semester}</td></tr>
        <tr><td style="padding: 6px;"><b>Materi Pokok</b></td><td>${result.identitas.materiPokok}</td></tr>
        <tr><td style="padding: 6px;"><b>Alokasi Waktu</b></td><td>${result.identitas.alokasiWaktu}</td></tr>
        <tr><td style="padding: 6px;"><b>Penyusun</b></td><td>${result.identitas.penyusun}</td></tr>
      </table>

      <h3>B. TUJUAN PEMBELAJARAN & PEMAHAMAN BERMAKNA</h3>
      <ol>
        ${result.tujuanPembelajaran.map((tp) => `<li>${tp}</li>`).join('')}
      </ol>
      <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 10px; margin: 10px 0;">
        <b>Pemahaman Bermakna:</b><br/>
        ${result.pemahamanBermakna}
      </div>

      <h3>C. PERTANYAAN PEMANTIK</h3>
      <ul>
        ${result.pertanyaanPemantik.map((q) => `<li>${q}</li>`).join('')}
      </ul>

      <h3>D. LANGKAH-LANGKAH PEMBELAJARAN</h3>
      <table style="width: 100%; border: 1px solid #cbd5e1;">
        <tr style="background-color: #f1f5f9;"><th style="width: 25%;">Kegiatan</th><th>Deskripsi Pembelajaran Berbasis Cinta</th><th style="width: 15%;">Waktu</th></tr>
        <tr>
          <td><b>Pendahuluan</b></td>
          <td>
            <ul>${result.kegiatanPembelajaran.pendahuluan.langkah.map((l) => `<li>${l}</li>`).join('')}</ul>
          </td>
          <td>${result.kegiatanPembelajaran.pendahuluan.durasi}</td>
        </tr>
        <tr>
          <td><b>Kegiatan Inti</b><br/><span style="font-size: 9pt; color: #047857;">(Mindful, Meaningful, Joyful)</span></td>
          <td>
            <p><b>1. Mindful Learning (Sadar Penuh):</b></p>
            <ul>${result.kegiatanPembelajaran.inti.mindfulLearning.map((l) => `<li>${l}</li>`).join('')}</ul>
            <p><b>2. Meaningful Learning (Bermakna Kontekstual):</b></p>
            <ul>${result.kegiatanPembelajaran.inti.meaningfulLearning.map((l) => `<li>${l}</li>`).join('')}</ul>
            <p><b>3. Joyful Learning (Gembira & Kolaboratif):</b></p>
            <ul>${result.kegiatanPembelajaran.inti.joyfulLearning.map((l) => `<li>${l}</li>`).join('')}</ul>
          </td>
          <td>${result.kegiatanPembelajaran.inti.durasi}</td>
        </tr>
        <tr>
          <td><b>Penutup</b></td>
          <td>
            <ul>${result.kegiatanPembelajaran.penutup.langkah.map((l) => `<li>${l}</li>`).join('')}</ul>
          </td>
          <td>${result.kegiatanPembelajaran.penutup.durasi}</td>
        </tr>
      </table>

      <h3>E. ASESMEN PEMBELAJARAN</h3>
      <ul>
        <li><b>Asesmen Diagnostik Awal:</b> ${result.asesmen.diagnostik}</li>
        <li><b>Asesmen Formatif (Proses):</b> ${result.asesmen.formatif}</li>
        <li><b>Asesmen Sumatif (Lingkup Materi):</b> ${result.asesmen.sumatif}</li>
      </ul>
      <p><b>Pedoman Rubrik:</b> ${result.asesmen.rubrik}</p>

      <h3>F. DIFERENSIASI PEMBELAJARAN</h3>
      <table style="width: 100%; border: 1px solid #cbd5e1;">
        <tr><td style="width: 25%;"><b>Diferensiasi Konten</b></td><td>${result.diferensiasi.konten}</td></tr>
        <tr><td><b>Diferensiasi Proses</b></td><td>${result.diferensiasi.proses}</td></tr>
        <tr><td><b>Diferensiasi Produk</b></td><td>${result.diferensiasi.produk}</td></tr>
      </table>

      <h3>G. MEDIA DAN SUMBER BELAJAR</h3>
      <ul>
        ${result.mediaSumber.map((m) => `<li>${m}</li>`).join('')}
      </ul>

      <h3>H. REFLEKSI GURU DAN PESERTA DIDIK</h3>
      <p><b>Refleksi Guru:</b></p>
      <ul>${result.refleksi.refleksiGuru.map((r) => `<li>${r}</li>`).join('')}</ul>
      <p><b>Refleksi Peserta Didik:</b></p>
      <ul>${result.refleksi.refleksiSiswa.map((r) => `<li>${r}</li>`).join('')}</ul>
    `;

    aiService.exportToWord(
      `Modul_Ajar_${formData.subject}_${formData.grade}`,
      `Modul Ajar ${formData.subject}`,
      html
    );
    onNotify?.('Modul Ajar diekspor ke Microsoft Word (.doc)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Penyusun Modul Ajar Cerdas</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Penyusun Modul Ajar Kurikulum Merdeka & Kurikulum Berbasis Cinta
            </h2>
            <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
              Menghasilkan rancangan Modul Ajar komprehensif dengan pendekatan Pembelajaran Mendalam (Mindful, Meaningful, Joyful Learning), integrasi adab islami, rubrik asesmen, dan diferensiasi kelas.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <span className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-[11px] text-amber-200">
              Model: Gemini 3.8 Flash
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Input & Hasil */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Parameter Input (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Parameter Modul Pembelajaran</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mata Pelajaran</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 bg-white"
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
                    <option value="PJOK">PJOK</option>
                    <option value="Seni Budaya">Seni Budaya</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Fase / Kelas</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 bg-white"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Semester & T.A.</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value as any })}
                      className="w-1/2 border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                    <input
                      type="text"
                      value={formData.academicYear}
                      onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                      className="w-1/2 border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                      placeholder="2024/2025"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Alokasi Waktu</label>
                  <input
                    type="text"
                    value={formData.timeAllocation}
                    onChange={(e) => setFormData({ ...formData, timeAllocation: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="Contoh: 2 x 35 Menit"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Topik / Materi Pokok</label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Misal: Teks Narasi & Kalimat Transitif"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tujuan Pembelajaran (TP)</label>
                <textarea
                  rows={2}
                  value={formData.tp}
                  onChange={(e) => setFormData({ ...formData, tp: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  placeholder="Rumuskan tujuan pembelajaran yang ingin dicapai..."
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Karakteristik Peserta Didik</label>
                <input
                  type="text"
                  value={formData.studentCharacteristics}
                  onChange={(e) => setFormData({ ...formData, studentCharacteristics: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Aktif, visual, menyukai kerja kelompok"
                />
              </div>

              {/* Kurikulum Berbasis Cinta & Deep Learning */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>Ciri Khas MI Ma’arif Al Ihsan Soborejo</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block">Nilai Kurikulum Berbasis Cinta:</span>
                  <input
                    type="text"
                    value={formData.cintaValues}
                    onChange={(e) => setFormData({ ...formData, cintaValues: e.target.value })}
                    className="w-full border border-emerald-300 rounded-md p-1.5 text-[11px] bg-white mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block">Pendekatan Pembelajaran Mendalam:</span>
                  <input
                    type="text"
                    value={formData.deepLearningApproach}
                    onChange={(e) => setFormData({ ...formData, deepLearningApproach: e.target.value })}
                    className="w-full border border-emerald-300 rounded-md p-1.5 text-[11px] bg-white mt-0.5"
                  />
                </div>
              </div>

              <button
                onClick={() => handleGenerate()}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini AI Sedang Merancang Modul...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Buat Rancangan Modul Ajar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Output: Dokumen Hasil Modul Ajar (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-full min-h-[600px]">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {result ? 'Draf Modul Ajar (Siap Diedit & Ditelaah)' : 'Pratinjau Hasil Rancangan'}
                </span>
                {result && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    Draf AI Terstruktur
                  </span>
                )}
              </div>

              {result && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-colors ${
                      isEditing
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Selesai Edit' : 'Edit Hasil'}</span>
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
                    title="Ekspor ke Microsoft Word (.doc)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>

                  <button
                    onClick={() => aiService.exportToPrintPDF('preview-modul-content')}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Cetak Dokumen / Simpan PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-semibold flex items-center gap-1 hover:bg-slate-900 shadow-xs"
                    title="Simpan sebagai Draf Lokal"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>

                  <button
                    onClick={handleSubmitForReview}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold flex items-center gap-1 hover:bg-emerald-700 shadow-xs"
                    title="Ajukan untuk Telaah Kepala Madrasah"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Ajukan</span>
                  </button>
                </div>
              )}
            </div>

            {/* Document Body */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h4 className="text-sm font-bold text-slate-700">Menyusun Modul Ajar Berbasis Cinta</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Gemini AI sedang merumuskan tahapan Mindful, Meaningful, dan Joyful Learning yang disesuaikan dengan kultur santri MI Al Ihsan Soborejo...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada Rancangan Modul</h4>
                <p className="text-xs max-w-xs mt-1">
                  Lengkapi parameter di sebelah kiri lalu klik tombol "Buat Rancangan Modul Ajar" untuk memulai.
                </p>
              </div>
            ) : (
              <div id="preview-modul-content" className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                {/* Notice Pemeriksaan Guru */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-800 leading-tight">
                    <b>Prinsip Pemeriksaan Guru:</b> Hasil rancangan AI ini adalah draf awal. Periksa dan sesuaikan kembali langkah pembelajaran sesuai kondisi faktual siswa Anda sebelum diajukan ke Kepala Madrasah.
                  </div>
                </div>

                {/* Section Regenerasi Parsial */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Regenerasi Bagian Tertentu:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSectionToRegen}
                      onChange={(e) => setSelectedSectionToRegen(e.target.value)}
                      className="border border-slate-300 rounded p-1 text-xs bg-white"
                    >
                      <option value="">Pilih Bagian...</option>
                      <option value="Kegiatan Inti (Deep Learning)">Kegiatan Inti (Deep Learning)</option>
                      <option value="Pertanyaan Pemantik">Pertanyaan Pemantik</option>
                      <option value="Asesmen & Rubrik">Asesmen & Rubrik</option>
                      <option value="Diferensiasi Pembelajaran">Diferensiasi Pembelajaran</option>
                    </select>
                    <button
                      onClick={() => selectedSectionToRegen && handleGenerate(selectedSectionToRegen)}
                      disabled={!selectedSectionToRegen || isLoading}
                      className="px-2.5 py-1 rounded bg-emerald-700 text-white font-semibold text-[11px] hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
                    >
                      Regenerasi
                    </button>
                  </div>
                </div>

                {/* Identitas Card */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                  <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-wider mb-2">
                    I. IDENTITAS MODUL
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Madrasah:</span>
                      <span className="font-semibold">{result.identitas.madrasah}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Mata Pelajaran:</span>
                      <span className="font-semibold text-emerald-900">{result.identitas.mataPelajaran}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Fase & Kelas:</span>
                      <span className="font-semibold">{result.identitas.faseKelas}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Alokasi Waktu:</span>
                      <span className="font-semibold">{result.identitas.alokasiWaktu}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tahun Ajaran / Semester:</span>
                      <span className="font-semibold">{result.identitas.tahunAjaran} / {result.identitas.semester}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Materi Pokok:</span>
                      <span className="font-semibold">{result.identitas.materiPokok}</span>
                    </div>
                  </div>
                </div>

                {/* Tujuan Pembelajaran & Pemahaman Bermakna */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs mb-1">II. TUJUAN PEMBELAJARAN (TP)</h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                      {result.tujuanPembelajaran.map((tp, idx) => (
                        <li key={idx} className="leading-relaxed">{tp}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-emerald-50/60 border-l-3 border-emerald-600 p-3 rounded-r-lg">
                    <span className="font-bold text-emerald-800 block text-xs mb-0.5">Pemahaman Bermakna:</span>
                    <p className="text-slate-700 leading-relaxed text-xs">{result.pemahamanBermakna}</p>
                  </div>
                </div>

                {/* Pertanyaan Pemantik */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <h4 className="font-bold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>III. PERTANYAAN PEMANTIK</span>
                  </h4>
                  <div className="space-y-1.5">
                    {result.pertanyaanPemantik.map((q, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-amber-50/40 p-2 rounded-lg text-xs">
                        <span className="font-bold text-amber-700">{idx + 1}.</span>
                        <span className="text-slate-700">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Langkah-Langkah Pembelajaran (Deep Learning & KBC) */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>IV. LANGKAH PEMBELAJARAN (DEEP LEARNING)</span>
                  </h4>

                  {/* Pendahuluan */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between font-bold text-slate-800 text-xs mb-1.5">
                      <span>A. Kegiatan Pendahuluan</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                        {result.kegiatanPembelajaran.pendahuluan.durasi}
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                      {result.kegiatanPembelajaran.pendahuluan.langkah.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Inti (Mindful, Meaningful, Joyful) */}
                  <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between font-bold text-emerald-900 text-xs border-b border-emerald-100 pb-1">
                      <span>B. Kegiatan Inti (3 Pilar Pembelajaran Mendalam)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                        {result.kegiatanPembelajaran.inti.durasi}
                      </span>
                    </div>

                    {/* 1. Mindful */}
                    <div>
                      <span className="font-bold text-teal-800 text-[11px] block mb-1">
                        1. Mindful Learning (Sadar Penuh & Reflektif):
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-xs pl-2">
                        {result.kegiatanPembelajaran.inti.mindfulLearning.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 2. Meaningful */}
                    <div>
                      <span className="font-bold text-indigo-800 text-[11px] block mb-1">
                        2. Meaningful Learning (Bermakna & Kontekstual Soborejo):
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-xs pl-2">
                        {result.kegiatanPembelajaran.inti.meaningfulLearning.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 3. Joyful */}
                    <div>
                      <span className="font-bold text-amber-800 text-[11px] block mb-1">
                        3. Joyful Learning (Gembira, Kolaboratif & Penuh Kasih Sayang):
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-xs pl-2">
                        {result.kegiatanPembelajaran.inti.joyfulLearning.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Penutup */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between font-bold text-slate-800 text-xs mb-1.5">
                      <span>C. Kegiatan Penutup</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                        {result.kegiatanPembelajaran.penutup.durasi}
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                      {result.kegiatanPembelajaran.penutup.langkah.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Asesmen & Diferensiasi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Asesmen */}
                  <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">V. ASESMEN PEMBELAJARAN</h4>
                    <div className="space-y-1 text-xs">
                      <p><b className="text-slate-600">Diagnostik:</b> {result.asesmen.diagnostik}</p>
                      <p><b className="text-slate-600">Formatif:</b> {result.asesmen.formatif}</p>
                      <p><b className="text-slate-600">Sumatif:</b> {result.asesmen.sumatif}</p>
                    </div>
                  </div>

                  {/* Diferensiasi */}
                  <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">VI. DIFERENSIASI KELAS</h4>
                    <div className="space-y-1 text-xs">
                      <p><b className="text-slate-600">Konten:</b> {result.diferensiasi.konten}</p>
                      <p><b className="text-slate-600">Proses:</b> {result.diferensiasi.proses}</p>
                      <p><b className="text-slate-600">Produk:</b> {result.diferensiasi.produk}</p>
                    </div>
                  </div>
                </div>

                {/* Media & Refleksi */}
                <div className="border border-slate-200 rounded-xl p-3.5">
                  <h4 className="font-bold text-slate-800 text-xs mb-1.5">VII. MEDIA, SUMBER & REFLEKSI</h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600 block">Media dan Sumber Belajar:</span>
                      <ul className="list-disc list-inside text-slate-700">
                        {result.mediaSumber.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <span className="font-semibold text-emerald-800 block text-[11px]">Refleksi Guru:</span>
                        <ul className="list-disc list-inside text-slate-600 text-[11px]">
                          {result.refleksi.refleksiGuru.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                      <div>
                        <span className="font-semibold text-amber-800 block text-[11px]">Refleksi Siswa:</span>
                        <ul className="list-disc list-inside text-slate-600 text-[11px]">
                          {result.refleksi.refleksiSiswa.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
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
