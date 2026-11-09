import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { AIAuditLogEntry } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AIAuditLogsView: React.FC<Props> = ({ onNotify }) => {
  const [logs, setLogs] = useState<AIAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await aiService.getLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleFeedback = async (logId: string, rating: 'puas' | 'cukup' | 'perlu_perbaikan') => {
    const ok = await aiService.submitFeedback(logId, rating);
    if (ok) {
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, userFeedback: rating } : l))
      );
      onNotify?.('Terima kasih atas penilaian umpan balik Anda!', 'success');
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchType = filterType === 'all' || log.featureType === filterType;
    const matchSearch =
      !searchQuery ||
      log.promptSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <span>Pencatatan & Log Audit Penggunaan AI Gemini</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Merekam transparansi aktivitas kecerdasan buatan, model yang digunakan, kecepatan respon, dan penilaian pengguna.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama pengguna atau ringkasan modul..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-300 rounded-lg p-2 bg-white text-xs"
          >
            <option value="all">Semua Fitur AI</option>
            <option value="modul_ajar">Penyusun Modul Ajar</option>
            <option value="lkpd">Pembuat LKPD</option>
            <option value="soal_asesmen">Soal & Asesmen</option>
            <option value="ide_pembelajaran">Ide Pembelajaran</option>
            <option value="refleksi_guru">Refleksi Guru</option>
            <option value="analisis_belajar">Analisis Hasil Belajar</option>
            <option value="kepala_madrasah">Asisten Kepala Madrasah</option>
            <option value="tanya_jawab">Tanya Jawab SIMPEL</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <th className="p-3">Waktu</th>
              <th className="p-3">Pengguna & Peran</th>
              <th className="p-3">Fitur AI</th>
              <th className="p-3">Ringkasan Prompt</th>
              <th className="p-3">Model</th>
              <th className="p-3">Durasi</th>
              <th className="p-3">Feedback Pengguna</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  Tidak ada catatan log AI yang sesuai.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-slate-800 block">{log.userName}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{log.userRole}</span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                      {log.featureType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700 max-w-xs truncate" title={log.promptSummary}>
                    {log.promptSummary}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-slate-600">
                    {log.modelName}
                  </td>
                  <td className="p-3 text-slate-600 font-mono text-[11px]">
                    {log.durationMs} ms
                  </td>
                  <td className="p-3">
                    {log.userFeedback ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] capitalize">
                        ⭐ {log.userFeedback}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback(log.id, 'puas')}
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          title="Puas"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(log.id, 'perlu_perbaikan')}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Perlu Perbaikan"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
