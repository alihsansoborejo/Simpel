import React, { useState } from 'react';
import {
  Sparkles,
  Gamepad2,
  BookOpen,
  Copy,
  Lightbulb,
  TreePine,
  RefreshCw,
  HeartHandshake,
  MessageSquareQuote,
  Layers,
} from 'lucide-react';
import { LearningIdeaRequest, LearningIdeaResult } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const LearningIdeasGenerator: React.FC<Props> = ({ onNotify }) => {
  const { user, activeRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LearningIdeaResult | null>(null);

  const [formData, setFormData] = useState<LearningIdeaRequest>({
    subject: 'IPAS',
    grade: 'Kelas 4',
    topic: 'Bagian Tumbuhan dan Fungsinya Bagi Kehidupan',
    category: 'all',
  });

  const handleGenerate = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const res = await aiService.generateLearningIdeas(formData);
      setResult(res);

      await aiService.logUsage({
        userId: user?.id || 'guru-anon',
        userName: user?.profile?.full_name || 'Guru MI Al Ihsan',
        userRole: activeRole || 'guru',
        featureType: 'ide_pembelajaran',
        promptSummary: `Ide Pembelajaran: ${formData.subject} - ${formData.topic}`,
        durationMs: Date.now() - startTime,
        status: 'sukses',
      });

      onNotify?.('Ide media dan aktivitas pembelajaran berhasil dirumuskan!', 'success');
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal memuat ide pembelajaran.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `
IDE PEMBELAJARAN & MEDIA KREATIF MI MA'ARIF AL IHSAN
Topik: ${result.topik}

A. AKTIVITAS BELAJAR KONTEKSTUAL
${result.ideAktivitas.map((a) => `- ${a.namaAktivitas} (${a.kategori}):\n  ${a.deskripsi}\n  Alat: ${a.alatBahan.join(', ')}\n  Nilai Karakter: ${a.nilaiKarakter}`).join('\n\n')}

B. PERMAINAN EDUKATIF (EDUGAMES)
${result.permainanEdukatif.map((g) => `- ${g.namaGame}:\n  Aturan: ${g.aturanMain}\n  Manfaat: ${g.manfaatBelajar}`).join('\n\n')}

C. CERITA KONTEKSTUAL ISLAMI
"${result.ceritaKontekstual.judulCerita}"
${result.ceritaKontekstual.naskahCerita}
Pesan Moral: ${result.ceritaKontekstual.pesanMoral}

D. MEDIA BELAJAR BERBASIS LINGKUNGAN DESA SOBOREJO
${result.ideMediaLingkungan.map((m) => `- ${m.namaMedia}:\n  Bahan: ${m.bahanSekitar.join(', ')}\n  Cara Buat: ${m.caraMembuat}\n  Cara Pakai: ${m.caraPenggunaan}`).join('\n\n')}
    `.trim();

    const ok = await aiService.copyText(text);
    if (ok) onNotify?.('Seluruh ide pembelajaran disalin ke clipboard!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/80 text-amber-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Kreativitas & Media Pembelajaran</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Ide Pembelajaran Kontekstual, Edugames, & Media Murah Lingkungan
        </h2>
        <p className="text-xs text-emerald-100 max-w-2xl mt-1 leading-relaxed">
          Membantu guru MI menemukan inspirasi permainan edukatif (Joyful Learning), cerita pembuka berhikmah islami, kegiatan kolaboratif, dan pemanfaatan bahan alam pedesaan Soborejo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Input (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Inspirasi Pembelajaran</span>
            </h3>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mata Pelajaran</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="IPAS">IPAS (Sains & Sosial)</option>
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                <option value="Matematika">Matematika</option>
                <option value="Pendidikan Pancasila">Pendidikan Pancasila</option>
                <option value="Al-Qur’an Hadis">Al-Qur’an Hadis</option>
                <option value="Akidah Akhlak">Akidah Akhlak</option>
                <option value="Fikih">Fikih</option>
                <option value="Seni Budaya">Seni Budaya & Prakarya</option>
                <option value="PJOK">PJOK</option>
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

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Topik / Materi yang Diajarkan</label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
                placeholder="Misal: Bagian Tumbuhan dan Fungsinya"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Fokus Inspirasi</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="all">Seluruh Ide (Game, Cerita, Media, Proyek)</option>
                <option value="ice_breaking_game">Permainan Edukatif (Edugames)</option>
                <option value="contextual_story">Cerita Pembuka Bermakna (Storytelling)</option>
                <option value="environmental_learning">Eksplorasi Lingkungan Soborejo</option>
                <option value="educational_media">Media Alat Peraga Murah (Daur Ulang)</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini Sedang Mencari Ide Seru...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Dapatkan Ide & Media Kreatif</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Cards (8 Cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-full min-h-[600px]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800">
                {result ? `Inspirasi Pembelajaran: ${result.topik}` : 'Pratinjau Ide & Media'}
              </span>

              {result && (
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Semua Ide</span>
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h4 className="text-sm font-bold text-slate-700">Merumuskan Ide Pembelajaran Menyenangkan</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Menyusun skenario permainan edukatif, cerita kontekstual santri, dan ide media kreatif ramah lingkungan...
                </p>
              </div>
            ) : !result ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Lightbulb className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-600">Belum Ada Ide Ditampilkan</h4>
                <p className="text-xs max-w-xs mt-1">
                  Pilih mata pelajaran dan topik di sisi kiri untuk memunculkan kumpulan ide edukasi yang hidup dan riang.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-800 overflow-y-auto max-h-[750px] pr-2">
                {/* 1. Permainan Edukatif (Edugames) */}
                <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                    <Gamepad2 className="w-4 h-4 text-amber-600" />
                    <span>Permainan Edukatif (Joyful Learning)</span>
                  </div>
                  {result.permainanEdukatif.map((g, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs space-y-1">
                      <span className="font-bold text-slate-800 text-xs text-amber-800">{g.namaGame}</span>
                      <p className="text-slate-700 leading-relaxed"><b className="text-slate-600">Aturan Main:</b> {g.aturanMain}</p>
                      <p className="text-emerald-700 font-medium text-[11px]"><b className="text-slate-600">Manfaat:</b> {g.manfaatBelajar}</p>
                    </div>
                  ))}
                </div>

                {/* 2. Cerita Kontekstual Islami */}
                {result.ceritaKontekstual && (
                  <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs">
                      <MessageSquareQuote className="w-4 h-4 text-emerald-700" />
                      <span>Cerita Kontekstual Pembuka KBM (Storytelling)</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-lg border border-emerald-200 shadow-2xs space-y-2">
                      <span className="font-bold text-emerald-800 text-xs">"{result.ceritaKontekstual.judulCerita}"</span>
                      <p className="text-slate-700 leading-relaxed text-[11px] italic bg-slate-50 p-2.5 rounded border border-slate-100">
                        {result.ceritaKontekstual.naskahCerita}
                      </p>
                      <div className="text-[11px] space-y-1">
                        <p><b className="text-emerald-800">Pesan Hikmah:</b> {result.ceritaKontekstual.pesanMoral}</p>
                        <div>
                          <b className="text-slate-700">Pertanyaan Diskusi Bersama:</b>
                          <ul className="list-disc list-inside text-slate-600 pl-1">
                            {result.ceritaKontekstual.pertanyaanDiskusi.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Ide Aktivitas Belajar */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <HeartHandshake className="w-4 h-4 text-indigo-600" />
                    <span>Aktivitas Kolaboratif & Eksplorasi</span>
                  </div>
                  <div className="space-y-2">
                    {result.ideAktivitas.map((act, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-slate-800 text-xs">
                          <span>{act.namaAktivitas}</span>
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px]">
                            {act.kategori}
                          </span>
                        </div>
                        <p className="text-slate-700">{act.deskripsi}</p>
                        <div className="text-[11px] text-slate-600">
                          <b>Alat & Bahan:</b> {act.alatBahan.join(', ')}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium">
                          <b>Karakter yang Dibangun:</b> {act.nilaiKarakter}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Media Pembelajaran Berbasis Lingkungan Desa Soborejo */}
                <div className="border border-teal-200 bg-teal-50/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-teal-900 text-xs">
                    <TreePine className="w-4 h-4 text-teal-700" />
                    <span>Alat Peraga Murah Berbasis Alam Pedesaan Soborejo</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {result.ideMediaLingkungan.map((med, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-teal-200 shadow-2xs space-y-1 text-[11px]">
                        <span className="font-bold text-teal-800 block">{med.namaMedia}</span>
                        <p><b className="text-slate-600">Bahan Sekitar:</b> {med.bahanSekitar.join(', ')}</p>
                        <p><b className="text-slate-600">Cara Buat:</b> {med.caraMembuat}</p>
                        <p><b className="text-slate-600">Cara Pakai:</b> {med.caraPenggunaan}</p>
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
