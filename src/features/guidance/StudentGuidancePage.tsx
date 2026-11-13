import React, { useState, useEffect } from 'react';
import { guidanceService } from '../../services/guidanceService';
import { academicService } from '../../services/academicService';
import { StudentGuidanceRecord, Student, GuidanceStatus } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  HeartHandshake,
  Plus,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Heart,
  Lock,
} from 'lucide-react';

export const StudentGuidancePage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [records, setRecords] = useState<StudentGuidanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [studentId, setStudentId] = useState<string>('');
  const [guidanceDate, setGuidanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [guidanceType, setGuidanceType] = useState<
    'Belajar' | 'Sosial' | 'Perilaku' | 'Motivasi' | 'Keluarga'
  >('Belajar');
  const [problemDesc, setProblemDesc] = useState<string>('');
  const [counselingSummary, setCounselingSummary] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [guidanceStatus, setGuidanceStatus] = useState<GuidanceStatus>('Dalam_Proses');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recs, stds] = await Promise.all([
        guidanceService.getGuidanceRecords(activeRole, user?.id || 'usr-guru-1'),
        academicService.getStudents(),
      ]);
      setRecords(recs);
      setStudents(stds);
      if (stds.length > 0) setStudentId(stds[0].id);
    } catch (err) {
      console.error('Gagal memuat catatan bimbingan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeRole]);

  useRealtimeSync(['simpel_student_guidance', 'simpel_students'], () => {
    void loadData();
  });

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await guidanceService.createGuidanceRecord({
        student_id: studentId,
        recorded_by: user?.id || 'usr-guru-1',
        guidance_date: guidanceDate,
        guidance_type: guidanceType,
        problem_description: problemDesc,
        counseling_summary: counselingSummary,
        recommendation_followup: recommendation,
        status: guidanceStatus,
      });
      setShowModal(false);
      setStatusMessage('Catatan bimbingan siswa berhasil disimpan secara rahasia.');
      loadData();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan bimbingan:', err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: GuidanceStatus) => {
    try {
      await guidanceService.updateGuidanceStatus(id, newStatus);
      loadData();
    } catch (err) {
      console.error('Gagal mengubah status bimbingan:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Bimbingan Siswa (BK & Layanan Psikopedagogis)
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Privasi Terlindungi RLS</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan bimbingan santri berbasis kasih sayang (Kurikulum Berbasis Cinta) yang hanya dapat diakses oleh guru pencatat dan Kepala Madrasah.
          </p>
        </div>
        <button
          onClick={() => {
            setProblemDesc('');
            setCounselingSummary('');
            setRecommendation('');
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Catatan Bimbingan</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Daftar Catatan Bimbingan Terlindungi */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Memuat rekam bimbingan siswa...</div>
        ) : records.length === 0 ? (
          <div className="bg-white p-12 text-center border border-slate-200 rounded-xl text-slate-400 text-xs">
            Belum ada catatan bimbingan santri yang tersimpan untuk Anda.
          </div>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-200 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{r.student?.full_name || 'Santri'}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-emerald-800">Kategori: {r.guidance_type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Tanggal: {r.guidance_date}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[11px] text-slate-400">NIS: {r.student?.nis}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <select
                    value={r.status}
                    onChange={(e) => handleUpdateStatus(r.id, e.target.value as GuidanceStatus)}
                    className="text-xs font-bold px-2 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-emerald-600"
                  >
                    <option value="Memerlukan_Tindak_Lanjut">Memerlukan Tindak Lanjut</option>
                    <option value="Dalam_Proses">Dalam Proses</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              {/* Rincian Masalah & Konseling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">Uraian Pengamatan / Isu:</span>
                    <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {r.problem_description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-800 font-semibold mb-0.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      <span>Ringkasan Konseling (Kurikulum Berbasis Cinta):</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
                      {r.counseling_summary}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">
                      Rencana Pendampingan Lanjutan:
                    </span>
                    <p className="text-slate-600 leading-relaxed">{r.recommendation_followup}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Tambah Rekam Bimbingan */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-base font-bold text-slate-900 mb-1">Catat Bimbingan Santri Baru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Rekam bimbingan konseling dan pendampingan karakter terlindungi kebijakan RLS Supabase.
            </p>

            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                    required
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} (NIS: {s.nis})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Konseling</label>
                  <input
                    type="date"
                    value={guidanceDate}
                    onChange={(e) => setGuidanceDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Layanan</label>
                  <select
                    value={guidanceType}
                    onChange={(e) =>
                      setGuidanceType(e.target.value as 'Belajar' | 'Sosial' | 'Perilaku' | 'Motivasi' | 'Keluarga')
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  >
                    <option value="Belajar">Kesulitan Belajar & Akademik</option>
                    <option value="Perilaku">Kedisiplinan & Adab Santri</option>
                    <option value="Sosial">Hubungan Sosial & Pertemanan</option>
                    <option value="Motivasi">Motivasi & Kepercayaan Diri</option>
                    <option value="Keluarga">Dukungan Keluarga / Rumah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Penanganan</label>
                  <select
                    value={guidanceStatus}
                    onChange={(e) => setGuidanceStatus(e.target.value as GuidanceStatus)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  >
                    <option value="Dalam_Proses">Dalam Proses Pendampingan</option>
                    <option value="Memerlukan_Tindak_Lanjut">Memerlukan Tindak Lanjut Khusus</option>
                    <option value="Selesai">Tuntas / Selesai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uraian Masalah / Temuan Pengamatan
                </label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan secara objektif perilaku atau kendala yang dialami anak..."
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ringkasan Konseling (Pendekatan Kasih Sayang)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ceritakan proses dialog hangat, menggali perasaan santri, dan penguatan nilai cinta..."
                  value={counselingSummary}
                  onChange={(e) => setCounselingSummary(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rencana Tindak Lanjut & Komunikasi Orang Tua
                </label>
                <textarea
                  rows={2}
                  placeholder="Langkah pendampingan berikutnya dan jadwal konfirmasi dengan wali santri..."
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Catatan BK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
