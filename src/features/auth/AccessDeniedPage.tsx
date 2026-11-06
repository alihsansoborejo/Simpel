import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  onBackToDashboard: () => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedProps> = ({ onBackToDashboard }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-100">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 tracking-tight">Akses Ditolak (403 Forbidden)</h2>
      <p className="mt-2 text-xs text-slate-500 max-w-md">
        Anda tidak memiliki hak akses atau izin untuk membuka halaman ini. Hak akses dibatasi secara ketat berdasarkan kebijakan Row Level Security (RLS) dan peran Anda di madrasah.
      </p>

      <button
        onClick={onBackToDashboard}
        className="mt-6 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors shadow-xs"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Dasbor Utama</span>
      </button>
    </div>
  );
};
