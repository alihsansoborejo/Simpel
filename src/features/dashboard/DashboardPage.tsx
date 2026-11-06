import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { PrincipalDashboard } from './PrincipalDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { HomeroomDashboard } from './HomeroomDashboard';
import { ROLE_CONFIGS } from '../../types/auth.types';
import { UserRole } from '../../types/database.types';

interface DashboardPageProps {
  onNavigate: (view: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { activeRole, availableRoles, switchActiveRole } = useAuth();

  return (
    <div className="space-y-6">
      {/* Jika pengguna memiliki lebih dari 1 peran (misal Guru sekaligus Wali Kelas) */}
      {availableRoles.length > 1 && (
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Tampilan Dasbor Aktif: </span>
            <span>Anda memiliki hak akses multi-peran ({availableRoles.map(r => ROLE_CONFIGS[r].label).join(', ')}).</span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            {availableRoles.map((role: UserRole) => {
              const isSelected = role === activeRole;
              const cfg = ROLE_CONFIGS[role];
              return (
                <button
                  key={role}
                  onClick={() => switchActiveRole(role)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Render dasbor sesuai activeRole */}
      {activeRole === 'admin' && <AdminDashboard onNavigate={onNavigate} />}
      {activeRole === 'kepala_madrasah' && <PrincipalDashboard onNavigate={onNavigate} />}
      {activeRole === 'guru' && <TeacherDashboard onNavigate={onNavigate} />}
      {activeRole === 'wali_kelas' && <HomeroomDashboard onNavigate={onNavigate} />}
    </div>
  );
};
