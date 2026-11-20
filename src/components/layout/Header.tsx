import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { ROLE_CONFIGS } from '../../types/auth.types';
import { UserRole } from '../../types/database.types';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { fileStorageService } from '../../services/fileStorageService';
import { useSync } from '../../context/SyncContext';
import {
  Menu,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Calendar,
  Database,
  ArrowRightLeft,
  HelpCircle,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { NotificationDrawer } from '../notification/NotificationDrawer';
import { HelpGuideModal } from '../common/HelpGuideModal';

interface HeaderProps {
  onToggleMobileNav: () => void;
  onNavigate: (view: string) => void;
  activeView: string;
}

export const Header: React.FC<HeaderProps> = React.memo(({ onToggleMobileNav, onNavigate, activeView }) => {
  const { user, activeRole, availableRoles, switchActiveRole, logout } = useAuth();
  const { isConnected: isDriveConnected, googleUser } = useGoogleDrive();
  const { status: syncStatus, activeDevices, syncNow, supabaseStatus, supabaseError, localServerAvailable } = useSync();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(5);
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
  const driveStatus = fileStorageService.getDriveStatusInfo();
  const isAppsScriptHealthy = driveStatus.isHealthy;
  const isAppsScriptError = driveStatus.isError;
  const isAnyDriveActive = isAppsScriptHealthy || isDriveConnected;

  const isCloudIssue = isSupabaseConfigured && (supabaseStatus === 'quota_exceeded' || supabaseStatus === 'error');
  const isHealthyConnected =
    syncStatus === 'connected' &&
    (localServerAvailable || isSupabaseConfigured) &&
    (!isSupabaseConfigured || supabaseStatus === 'connected' || supabaseStatus === 'local_mode');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white/95 backdrop-blur-xs border-b border-emerald-200/80">
      {/* Left: Mobile Toggle & Breadcrumb / Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="p-2 -ml-2 text-emerald-800 rounded-lg md:hidden hover:bg-emerald-50"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>TA 2026/2027 Ganjil</span>
          </div>

          <span className="hidden sm:inline" aria-hidden="true">·</span>

          <span className="text-emerald-950 font-medium capitalize">
            {activeView.replace('-', ' ')}
          </span>
        </div>
      </div>

      {/* Right: Role Switcher, Database Status, Notifications, & Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Real-Time Cross-Device Sync Status Button */}
        <button
          onClick={async () => {
            setIsManualSyncing(true);
            try {
              await syncNow();
            } finally {
              setTimeout(() => setIsManualSyncing(false), 400);
            }
          }}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
            syncStatus === 'offline'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : isCloudIssue
              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              : isHealthyConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
          title={
            supabaseStatus === 'local_mode'
              ? 'Mode Server Lokal aktif (bypass Supabase). Klik untuk menyinkronkan data antarperangkat.'
              : supabaseError ||
                'Klik untuk menyinkronkan data antarperangkat dan menguji ulang koneksi database sekarang'
          }
        >
          {isManualSyncing || syncStatus === 'syncing' ? (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
          ) : (
            <Database
              className={`w-3.5 h-3.5 ${
                syncStatus === 'offline'
                  ? 'text-rose-500'
                  : isCloudIssue
                  ? 'text-amber-600'
                  : isHealthyConnected
                  ? 'text-emerald-600'
                  : 'text-amber-600'
              }`}
            />
          )}
          <span>
            {isManualSyncing || syncStatus === 'syncing'
              ? 'Menyinkronkan...'
              : syncStatus === 'offline'
              ? 'Mode Offline'
              : supabaseStatus === 'local_mode'
              ? !localServerAvailable
                ? 'Mode Lokal (Browser)'
                : syncStatus === 'connected'
                ? `Mode Server Lokal${activeDevices > 1 ? ` (${activeDevices})` : ''}`
                : 'Mode Server Lokal'
              : supabaseStatus === 'quota_exceeded'
              ? syncStatus === 'connected' && localServerAvailable
                ? 'Sync Lokal · Kuota Cloud Penuh'
                : 'Kuota Cloud Penuh'
              : supabaseStatus === 'error'
              ? syncStatus === 'connected' && localServerAvailable
                ? 'Sync Lokal · Cloud Gangguan'
                : 'Koneksi Cloud Gangguan'
              : isSupabaseConfigured && syncStatus === 'connected'
              ? localServerAvailable
                ? 'Supabase Live + Sync'
                : 'Supabase Live'
              : syncStatus === 'connected'
              ? localServerAvailable
                ? `Sinkron Real-Time${activeDevices > 1 ? ` (${activeDevices})` : ''}`
                : 'Mode Lokal (Browser)'
              : 'Menyambungkan...'}
          </span>
        </button>

        {/* Google Drive Status Button */}
        {activeRole !== 'wali_kelas' && (
          <button
            onClick={() => onNavigate('penyimpanan-drive')}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
              isAppsScriptError
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                : isAnyDriveActive
                ? 'bg-amber-50 text-emerald-950 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50/50'
            }`}
            title={
              isAppsScriptError
                ? `Koneksi Google Apps Script bermasalah: ${driveStatus.errorMessage || 'Klik untuk memperbaiki'}`
                : `Buka Penyimpanan Google Drive (${driveStatus.ownerEmail})`
            }
          >
            <HardDrive
              className={`w-3.5 h-3.5 ${
                isAppsScriptError
                  ? 'text-rose-600'
                  : isAnyDriveActive
                  ? 'text-amber-600'
                  : 'text-slate-400'
              }`}
            />
            <span className="truncate max-w-[165px]">
              {isAppsScriptError
                ? 'Drive Perlu Perbaikan'
                : isAppsScriptHealthy
                ? 'Drive Aktif (Tanpa Login)'
                : isDriveConnected
                ? (googleUser?.displayName || 'Drive Terhubung')
                : 'Google Drive'}
            </span>
            {isAppsScriptError ? (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            ) : (
              isAnyDriveActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        )}

        {/* Multi-role Switcher Pill (if user has > 1 role) */}
        {availableRoles.length > 1 && (
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Ganti Peran Aktif"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline font-semibold">{activeRoleConfig.label}</span>
              <ChevronDown className="w-3 h-3 text-emerald-700" />
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-emerald-200 py-1.5 z-40">
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
                        onNavigate('dashboard');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                        isSelected ? 'bg-emerald-50 text-emerald-950 font-semibold' : 'text-slate-700 hover:bg-emerald-50/50'
                      }`}
                    >
                      <span>{cfg.label}</span>
                      {isSelected && <span className="text-[10px] text-amber-700 font-bold">Aktif</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Help Guide Modal Trigger */}
        <button
          onClick={() => setIsHelpModalOpen(true)}
          className="p-2 text-emerald-700 rounded-lg hover:bg-emerald-50 hover:text-amber-700 transition-colors cursor-pointer"
          title="Buku Panduan Penggunaan SIMPEL"
        >
          <HelpCircle className="w-5 h-5 stroke-[1.75]" />
        </button>

        {/* Notifications Icon with Dynamic Unread Badge */}
        <button
          onClick={() => setIsNotificationOpen(true)}
          className="relative p-2 text-emerald-800 rounded-lg hover:bg-emerald-50 hover:text-emerald-950 transition-colors cursor-pointer"
          title="Pusat Notifikasi Akademik"
        >
          <Bell className="w-5 h-5 stroke-[1.75]" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-emerald-950 font-black text-[9px] flex items-center justify-center shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-emerald-50/80 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-300 font-bold text-xs flex items-center justify-center shadow-xs border-2 border-amber-400">
              {user?.profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-slate-900 leading-tight truncate max-w-[140px]">
                {user?.profile?.full_name || 'Pengguna'}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium capitalize">{activeRoleConfig?.label}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-emerald-200 py-1.5 z-40">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.profile?.full_name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
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

                <button
                  onClick={() => {
                    setIsHelpModalOpen(true);
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Buku Panduan SIMPEL</span>
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

      {/* Interactive Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onNavigate={onNavigate}
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />

      {/* Interactive Help & User Guide Modal */}
      <HelpGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        onNavigate={onNavigate}
      />
    </header>
  );
});
