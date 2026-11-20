import React from 'react';
import { LucideIcon, ArrowLeft, Clock } from 'lucide-react';

interface ModulePlaceholderProps {
  title: string;
  stageName?: string;
  description: string;
  icon: LucideIcon;
  onBack: () => void;
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  stageName,
  description,
  icon: Icon,
  onBack,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-emerald-200/80 p-8 shadow-xs text-center max-w-xl mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4 border border-amber-300">
        <Icon className="w-7 h-7 text-amber-600" />
      </div>

      {stageName && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200 mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>{stageName}</span>
        </div>
      )}

      <h3 className="text-lg font-bold text-emerald-950">{title}</h3>
      <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
        {description}
      </p>

      <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 rounded-lg transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dasbor</span>
        </button>
      </div>
    </div>
  );
};
