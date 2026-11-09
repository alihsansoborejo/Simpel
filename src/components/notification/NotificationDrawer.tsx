import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  CalendarCheck,
  ClipboardList,
  FolderSync,
  Award,
  AlertCircle,
  FileSpreadsheet,
  X,
  ExternalLink,
  Check,
  Filter,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../../types/database.types';
import { notificationService } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  onNavigate,
  onUnreadCountChange,
}) => {
  const { user, activeRole } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationService.getNotifications(user?.id, activeRole);
      setNotifications(data);
      const unread = data.filter((n) => !n.is_read).length;
      onUnreadCountChange?.(unread);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, activeRole]);

  const handleMarkAsRead = async (id: string, actionUrl?: string) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const unread = notifications.filter((n) => n.id !== id && !n.is_read).length;
    onUnreadCountChange?.(unread);

    if (actionUrl) {
      onNavigate(actionUrl);
      onClose();
    }
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead(activeRole);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    onUnreadCountChange?.(0);
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'presensi':
        return <CalendarCheck className="w-4 h-4 text-amber-600" />;
      case 'jurnal':
        return <ClipboardList className="w-4 h-4 text-emerald-600" />;
      case 'dokumen':
        return <FolderSync className="w-4 h-4 text-blue-600" />;
      case 'revisi_dokumen':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'nilai':
        return <FileSpreadsheet className="w-4 h-4 text-purple-600" />;
      case 'supervisi':
      case 'tindak_lanjut_supervisi':
        return <Award className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-emerald-700" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      return `${diffDays} hari lalu`;
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter((n) => {
    if (selectedCategory === 'all') return true;
    return n.category === selectedCategory;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="fixed top-0 right-0 z-50 w-full sm:w-96 md:w-[420px] h-screen bg-white shadow-2xl flex flex-col border-l border-slate-200 transition-transform duration-200 ease-in-out">
        {/* Header */}
        <div className="p-4 bg-emerald-900 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-800 text-amber-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Pusat Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                    {unreadCount} Baru
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-emerald-200">
                Pengingat akademik dan informasi operasional madrasah
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Category Filter */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5 text-[11px]">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Kategori:</span>
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none text-[11px]">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'presensi', label: 'Presensi' },
              { id: 'jurnal', label: 'Jurnal' },
              { id: 'dokumen', label: 'Dokumen' },
              { id: 'supervisi', label: 'Supervisi' },
              { id: 'nilai', label: 'Nilai' },
              { id: 'pengumuman', label: 'Pengumuman' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Memuat notifikasi...</p>
            </div>
          ) : filteredNotifs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Tidak ada notifikasi</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Semua pengingat tugas dan informasi madrasah telah terbaca.
              </p>
            </div>
          ) : (
            filteredNotifs.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkAsRead(n.id, n.action_url)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs relative ${
                  n.is_read
                    ? 'bg-white border-slate-200/90 text-slate-700'
                    : 'bg-emerald-50/50 border-emerald-300/80 text-slate-900 shadow-2xs'
                }`}
              >
                {!n.is_read && (
                  <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-emerald-200" />
                )}

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs">
                    {getCategoryIcon(n.category)}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        {n.category.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs mt-0.5 leading-snug">
                      {n.title}
                    </h4>

                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      {n.message}
                    </p>

                    {n.action_url && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900">
                        <span>Buka Halaman</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center shrink-0">
          <p className="text-[10px] text-slate-400">
            SIMPEL MI AL IHSAN · Notifikasi Operasional Akademik
          </p>
        </div>
      </aside>
    </>
  );
};
