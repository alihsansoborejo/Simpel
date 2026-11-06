import React, { useState, useEffect } from 'react';
import { assessmentService, LearningAnalysisResult } from '../../services/assessmentService';
import { Assessment } from '../../types/database.types';
import {
  TrendingUp,
  Award,
  Users,
  CheckCircle,
  AlertCircle,
  BarChart2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export const LearningAnalysisPage: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAsmId, setSelectedAsmId] = useState<string>('');
  const [analysis, setAnalysis] = useState<LearningAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const asms = await assessmentService.getAssessments();
      setAssessments(asms);
      if (asms.length > 0) {
        setSelectedAsmId(asms[0].id);
        const result = await assessmentService.getLearningAnalysis(asms[0].id, Number(asms[0].kktp));
        setAnalysis(result);
      }
    } catch (err) {
      console.error('Gagal menganalisis hasil belajar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectAsm = async (asmId: string) => {
    setSelectedAsmId(asmId);
    const found = assessments.find((a) => a.id === asmId);
    const kktp = found ? Number(found.kktp) : 75;
    try {
      const result = await assessmentService.getLearningAnalysis(asmId, kktp);
      setAnalysis(result);
    } catch (err) {
      console.error('Gagal memuat analisis asesmen:', err);
    }
  };

  const currentAsm = assessments.find((a) => a.id === selectedAsmId);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Analisis Hasil Belajar & Ketuntasan TP</h1>
          <p className="text-xs text-slate-500 mt-1">
            Statistik ketercapaian kompetensi dihitung secara langsung dari data nilai riil siswa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Pilih Asesmen:</span>
          <select
            value={selectedAsmId}
            onChange={(e) => handleSelectAsm(e.target.value)}
            className="text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-emerald-600 shadow-xs"
          >
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} (KKTP: {a.kktp})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading || !analysis ? (
        <div className="p-12 text-center text-slate-400 text-xs">Memproses statistik nilai siswa...</div>
      ) : (
        <>
          {/* Kartu Ringkasan Metrik Riil */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Rata-Rata Kelas
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {analysis.averageScore}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">/ 100</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {analysis.averageScore >= (currentAsm ? Number(currentAsm.kktp) : 75)
                  ? 'Di atas kriteria KKTP'
                  : 'Perlu penguatan klasikal'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Ketuntasan Belajar
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-emerald-800">
                  {analysis.passRate}%
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  ({analysis.passedCount}/{analysis.totalStudents} Siswa)
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                {analysis.remedialCount} siswa memerlukan remedial
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Nilai Tertinggi
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-emerald-900">
                  {analysis.highestScore}
                </span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Pencapaian maksimal tujuan ajar</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Nilai Terendah
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-rose-700">
                  {analysis.lowestScore}
                </span>
                <ArrowDownRight className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Titik fokus intervensi materi</p>
            </div>
          </div>

          {/* Distribusi Nilai & Analisis Kurikulum */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sebaran Nilai */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <BarChart2 className="w-5 h-5 text-emerald-800" />
                <h3 className="text-sm font-bold text-slate-900">Distribusi Capaian Kompetensi</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-800">Sangat Mahir (90 - 100)</span>
                    <span className="font-mono tabular-nums text-emerald-900">
                      {analysis.distribution.excellent} Siswa
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 rounded-full"
                      style={{
                        width: `${analysis.totalStudents > 0 ? (analysis.distribution.excellent / analysis.totalStudents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-800">Mahir (80 - 89)</span>
                    <span className="font-mono tabular-nums text-emerald-800">
                      {analysis.distribution.good} Siswa
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${analysis.totalStudents > 0 ? (analysis.distribution.good / analysis.totalStudents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-800">Cukup (70 - 79)</span>
                    <span className="font-mono tabular-nums text-amber-700">
                      {analysis.distribution.fair} Siswa
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${analysis.totalStudents > 0 ? (analysis.distribution.fair / analysis.totalStudents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-800">Perlu Bimbingan (&lt; 70)</span>
                    <span className="font-mono tabular-nums text-rose-700">
                      {analysis.distribution.needsHelp} Siswa
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-600 rounded-full"
                      style={{
                        width: `${analysis.totalStudents > 0 ? (analysis.distribution.needsHelp / analysis.totalStudents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Rekomendasi Tindak Lanjut Otomatis */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Rekomendasi Tindak Lanjut Diferensiasi</h3>
              </div>

              <div className="space-y-4 text-xs">
                {/* Siswa Butuh Remedial */}
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50">
                  <span className="font-bold text-rose-900 block mb-1">
                    Kandidat Remedial (Nilai &lt; {currentAsm?.kktp || 75}):
                  </span>
                  {analysis.remedialCandidates.length === 0 ? (
                    <p className="text-slate-600">Tidak ada siswa yang perlu remedial.</p>
                  ) : (
                    <div className="space-y-1">
                      {analysis.remedialCandidates.map((c) => (
                        <div key={c.studentId} className="flex justify-between text-slate-800">
                          <span>{c.studentName}</span>
                          <span className="font-mono tabular-nums font-bold text-rose-700">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Siswa Butuh Pengayaan */}
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <span className="font-bold text-emerald-900 block mb-1">
                    Kandidat Pengayaan (Nilai &ge; 88):
                  </span>
                  {analysis.enrichmentCandidates.length === 0 ? (
                    <p className="text-slate-600">Tidak ada siswa dengan skor &ge; 88.</p>
                  ) : (
                    <div className="space-y-1">
                      {analysis.enrichmentCandidates.map((c) => (
                        <div key={c.studentId} className="flex justify-between text-slate-800">
                          <span>{c.studentName}</span>
                          <span className="font-mono tabular-nums font-bold text-emerald-800">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
