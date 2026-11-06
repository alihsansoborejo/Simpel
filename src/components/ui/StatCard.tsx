import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'info' | 'neutral';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeType = 'neutral',
  onClick,
}) => {
  const badgeClasses = {
    success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    info: 'text-sky-700 bg-sky-50 border-sky-200',
    neutral: 'text-slate-600 bg-slate-100 border-slate-200',
  }[badgeType];

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:border-emerald-600 hover:shadow-sm' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono-numbers">{value}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="w-5 h-5 stroke-[1.75]" />
        </div>
      </div>

      {(subtitle || badgeText) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {badgeText && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${badgeClasses}`}>
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
