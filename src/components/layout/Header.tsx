import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_CONFIGS } from '../../types/auth.types';
import { UserRole } from '../../types/database.types';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  Menu,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Calendar,
  Database,
  ArrowRightLeft,
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileNav: () => void;
  onNavigate: (view: string) => void;
  activeView: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav, onNavigate, activeView }) => {
  const { user, activeRole, availableRoles, switchActiveRole, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setIsRoleMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeRoleConfig = ROLE_CONFIGS[activeRole];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-slate-200">
      {/* Left: Mobile Toggle & Breadcrumb / Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="p-2 -ml-2 text-slate-600 rounded-lg md:hidden hover:bg-slate-100"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <span>TA 2026/2027 Ganjil</span>
          </div>

          <span className="hidden sm:inline" aria-hidden="true">·</span>

          <span className="text-slate-700 font-medium capitalize">
            {activeView.replace('-', ' ')}
          </span>
        </div>
      </div>

      {/* Right: Role Switcher, Database Status, Notifications, & Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Supabase Status Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200">
          <Database className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-600' : 'text-amber-600'}`} />
          <span>{isSupabaseConfigured ? 'Supabase Live' : 'Demo Mode (Lokal)'}</span>
        </div>

        {/* Multi-role Switcher Pill (if user has > 1 role) */}
        {availableRoles.length > 1 && (
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
              title="Ganti Peran Aktif"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline font-semibold">{activeRoleConfig.label}</span>
              <ChevronDown className="w-3 h-3 text-amber-700" />
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Beralih Peran
                </div>
                {availableRoles.map((r: UserRole) => {
                  const cfg = ROLE_CONFIGS[r];
                  const isSelected = r === activeRole;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        switchActiveRole(r);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                        isSelected ? 'bg-emerald-50 text-emerald-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cfg.label}</span>
                      {isSelected && <span className="text-[10px] text-emerald-600 font-semibold">Aktif</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Notifications Icon */}
        <button
          onClick={() => alert('Fitur notifikasi: Belum ada pengumuman mendesak.')}
          className="relative p-2 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Notifikasi"
        >
          <Bell className="w-5 h-5 stroke-[1.75]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-600 rounded-full" />
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center shadow-xs">
              {user?.profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-slate-900 leading-tight truncate max-w-[140px]">
                {user?.profile?.full_name || 'Pengguna'}
              </p>
              <p className="text-[10px] text-slate-500 capitalize">{activeRoleConfig?.label}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.profile?.full_name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-1.5">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded border ${activeRoleConfig?.badgeColor}`}>
                    {activeRoleConfig?.label}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    onNavigate('profil');
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Profil & Pengaturan Akun</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={async () => {
                    setIsProfileMenuOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
