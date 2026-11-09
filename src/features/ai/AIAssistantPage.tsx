import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  FileText,
  Award,
  Lightbulb,
  Heart,
  TrendingUp,
  Building2,
  MessageSquare,
  FileBox,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ModulAjarGenerator } from './components/ModulAjarGenerator';
import { LKPDGenerator } from './components/LKPDGenerator';
import { AssessmentGenerator } from './components/AssessmentGenerator';
import { LearningIdeasGenerator } from './components/LearningIdeasGenerator';
import { TeacherReflectionAssistant } from './components/TeacherReflectionAssistant';
import { LearningAnalysisAssistant } from './components/LearningAnalysisAssistant';
import { PrincipalAssistant } from './components/PrincipalAssistant';
import { SimpelChatbot } from './components/SimpelChatbot';
import { AIAuditLogsView } from './components/AIAuditLogsView';
import { aiService } from '../../services/aiService';
import { AIDocumentDraft } from '../../types/ai.types';

interface Props {
  initialTab?: string;
  onNavigate?: (view: string) => void;
}

export const AIAssistantPage: React.FC<Props> = ({ initialTab = 'modul-ajar', onNavigate }) => {
  const { activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [drafts, setDrafts] = useState<AIDocumentDraft[]>([]);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    setDrafts(aiService.getDrafts());
  }, [activeTab]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const navTabs = [
    {
      id: 'modul-ajar',
      label: 'Penyusun Modul Ajar',
      icon: BookOpen,
      desc: 'Kurikulum Merdeka & Deep Learning',
      badge: 'Utama',
    },
    {
      id: 'lkpd',
      label: 'Pembuat LKPD',
      icon: FileText,
      desc: 'Lembar Kerja & Aktivitas Siswa',
      badge: 'Ramah Anak',
    },
    {
      id: 'soal-asesmen',
      label: 'Soal & Asesmen',
      icon: Award,
      desc: 'Kisi-kisi, PG, HOTS, & Penskoran',
      badge: 'Formatif/Sumatif',
    },
    {
      id: 'ide-pembelajaran',
      label: 'Ide Belajar & Media',
      icon: Lightbulb,
      desc: 'Edugames, Cerita, & Media Lokal',
      badge: 'Kreatif',
    },
    {
      id: 'refleksi-guru',
      label: 'Asisten Refleksi Guru',
      icon: Heart,
      desc: 'Diagnosis KBM & Solusi Berbasis Cinta',
      badge: 'Pedagogik',
    },
    {
      id: 'analisis-belajar',
      label: 'Analisis Hasil Belajar',
      icon: TrendingUp,
      desc: 'Remedial Terarah & Narasi Rapor',
      badge: 'Data Riil',
    },
    {
      id: 'kepala-madrasah',
      label: 'Asisten Kepala Madrasah',
      icon: Building2,
      desc: 'Telaah Mutu & Bahan Rapat Guru',
      badge: activeRole === 'kepala_madrasah' || activeRole === 'admin' ? 'Pimpinan' : 'Eksekutif',
    },
    {
      id: 'tanya-jawab',
      label: 'Asisten SIMPEL (Chat)',
      icon: MessageSquare,
      desc: 'Tanya Jawab & Konsultasi Madrasah',
      badge: 'Interaktif',
    },
    {
      id: 'draf-dokumen',
      label: `Draf Tersimpan (${drafts.length})`,
      icon: FileBox,
      desc: 'Arsip Draf & Pengajuan Telaah',
    },
    {
      id: 'audit-log',
      label: 'Log Audit AI',
      icon: ClipboardList,
      desc: 'Transparansi & Rating Feedback',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white transition-all transform animate-bounce-short ${
            notification.type === 'success'
              ? 'bg-emerald-700'
              : notification.type === 'error'
              ? 'bg-rose-700'
              : 'bg-indigo-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-amber-300" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-full hover:bg-white/20 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-600 to-teal-800 text-amber-300 flex items-center justify-center font-bold shadow-sm shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Asisten AI Gemini & Kecerdasan Pembelajaran</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                Tahap 6
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistem Informasi Manajemen Pembelajaran MI Ma’arif Al Ihsan Soborejo - Didukung Google Gemini 3.8 Flash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Privasi Siswa Terlindungi (Zero PII Leakage)</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Menu Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-amber-300' : 'text-slate-400'
                  }`}
                />
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
                          isActive
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'modul-ajar' && <ModulAjarGenerator onNotify={showNotification} />}
        {activeTab === 'lkpd' && <LKPDGenerator onNotify={showNotification} />}
        {activeTab === 'soal-asesmen' && <AssessmentGenerator onNotify={showNotification} />}
        {activeTab === 'ide-pembelajaran' && <LearningIdeasGenerator onNotify={showNotification} />}
        {activeTab === 'refleksi-guru' && <TeacherReflectionAssistant onNotify={showNotification} />}
        {activeTab === 'analisis-belajar' && <LearningAnalysisAssistant onNotify={showNotification} />}
        {activeTab === 'kepala-madrasah' && <PrincipalAssistant onNotify={showNotification} />}
        {activeTab === 'tanya-jawab' && <SimpelChatbot onNotify={showNotification} />}

        {/* Tab Draf Tersimpan */}
        {activeTab === 'draf-dokumen' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FileBox className="w-5 h-5 text-emerald-600" />
                  <span>Draf Dokumen Hasil AI Tersimpan</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dokumen rancangan Modul Ajar, LKPD, dan Asesmen yang tersimpan secara lokal dan dapat diajukan ke Kepala Madrasah untuk ditelaah.
                </p>
              </div>
            </div>

            {drafts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileBox className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="text-xs">Belum ada draf dokumen pembelajaran yang disimpan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 hover:bg-slate-50 space-y-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {d.featureType.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          d.status === 'diajukan'
                            ? 'bg-amber-100 text-amber-800'
                            : d.status === 'disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.status === 'diajukan' ? 'Menunggu Telaah' : d.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-800 text-xs line-clamp-2">{d.title}</h4>
                    <p className="text-[11px] text-slate-500">
                      {d.subject} - {d.grade} ({d.semester} {d.academicYear})
                    </p>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          aiService.submitDraftForReview(d.id);
                          setDrafts(aiService.getDrafts());
                          showNotification('Draf berhasil diajukan untuk telaah Kepala Madrasah!', 'success');
                        }}
                        disabled={d.status === 'diajukan'}
                        className="text-emerald-700 hover:text-emerald-900 font-bold disabled:opacity-40 cursor-pointer"
                      >
                        {d.status === 'diajukan' ? 'Telah Diajukan' : 'Ajukan Telaah'}
                      </button>

                      <button
                        onClick={() => {
                          aiService.deleteDraft(d.id);
                          setDrafts(aiService.getDrafts());
                          showNotification('Draf berhasil dihapus.', 'info');
                        }}
                        className="text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Log Audit */}
        {activeTab === 'audit-log' && <AIAuditLogsView onNotify={showNotification} />}
      </div>
    </div>
  );
};
