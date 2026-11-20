import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { GoogleDriveProvider } from './context/GoogleDriveContext';
import { SyncProvider } from './context/SyncContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AccessDeniedPage } from './features/auth/AccessDeniedPage';
import { ModulePlaceholder } from './components/common/ModulePlaceholder';
import { fileStorageService } from './services/fileStorageService';

// Lazy-loaded feature pages untuk startup ringan & perpindahan menu cepat
const GoogleDriveStoragePage = lazy(() =>
  import('./features/storage/GoogleDriveStoragePage').then((m) => ({ default: m.GoogleDriveStoragePage }))
);
const UserManagementPage = lazy(() =>
  import('./features/users/UserManagementPage').then((m) => ({ default: m.UserManagementPage }))
);
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const AcademicSettingsPage = lazy(() =>
  import('./features/academic/AcademicSettingsPage').then((m) => ({ default: m.AcademicSettingsPage }))
);
const ClassesPage = lazy(() =>
  import('./features/academic/ClassesPage').then((m) => ({ default: m.ClassesPage }))
);
const StudentsPage = lazy(() =>
  import('./features/academic/StudentsPage').then((m) => ({ default: m.StudentsPage }))
);
const TeachersPage = lazy(() =>
  import('./features/academic/TeachersPage').then((m) => ({ default: m.TeachersPage }))
);
const SubjectsPage = lazy(() =>
  import('./features/academic/SubjectsPage').then((m) => ({ default: m.SubjectsPage }))
);
const TeachingAssignmentsPage = lazy(() =>
  import('./features/academic/TeachingAssignmentsPage').then((m) => ({ default: m.TeachingAssignmentsPage }))
);
const CurriculumDocsPage = lazy(() =>
  import('./features/curriculum/CurriculumDocsPage').then((m) => ({ default: m.CurriculumDocsPage }))
);
const AttendancePage = lazy(() =>
  import('./features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage }))
);
const TeachingJournalPage = lazy(() =>
  import('./features/journal/TeachingJournalPage').then((m) => ({ default: m.TeachingJournalPage }))
);
const StudentGuidancePage = lazy(() =>
  import('./features/guidance/StudentGuidancePage').then((m) => ({ default: m.StudentGuidancePage }))
);
const SupervisionPage = lazy(() =>
  import('./features/supervision/SupervisionPage').then((m) => ({ default: m.SupervisionPage }))
);
const CurriculumManagementPage = lazy(() =>
  import('./features/curriculum/CurriculumManagementPage').then((m) => ({ default: m.CurriculumManagementPage }))
);
const KoKurikulerPage = lazy(() =>
  import('./features/kokurikuler/KoKurikulerPage').then((m) => ({ default: m.KoKurikulerPage }))
);
const EvaluationManagementPage = lazy(() =>
  import('./features/assessment/EvaluationManagementPage').then((m) => ({ default: m.EvaluationManagementPage }))
);
const GradeLedgerPage = lazy(() =>
  import('./features/assessment/GradeLedgerPage').then((m) => ({ default: m.GradeLedgerPage }))
);
const AIAssistantPage = lazy(() =>
  import('./features/ai/AIAssistantPage').then((m) => ({ default: m.AIAssistantPage }))
);
const InstitutionSettingsPage = lazy(() =>
  import('./features/settings/InstitutionSettingsPage').then((m) => ({ default: m.InstitutionSettingsPage }))
);
const DataMigrationPage = lazy(() =>
  import('./features/academic/DataMigrationPage').then((m) => ({ default: m.DataMigrationPage }))
);
const IssueTrackingPage = lazy(() =>
  import('./features/settings/IssueTrackingPage').then((m) => ({ default: m.IssueTrackingPage }))
);
const HelpCenterPage = lazy(() =>
  import('./features/settings/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage }))
);

import {
  CalendarCheck,
  ClipboardList,
  FolderSync,
  Award,
  Sparkles,
  FileSpreadsheet,
  Users,
  GraduationCap,
  School,
  BookOpen,
  Database,
  HeartHandshake,
} from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, activeRole, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<string>('dashboard');

  // Pemeriksaan Hak Akses (Route Guard berdasarkan activeRole)
  const isAuthorized = (view: string): boolean => {
    if (view === 'dashboard' || view === 'profil' || view === 'pusat-bantuan' || view === 'lapor-kendala' || view.startsWith('asisten-ai')) return true;

    if (
      view.startsWith('penugasan-') ||
      [
        'kelola-pengguna',
        'master-guru',
        'master-siswa',
        'master-kelas',
        'master-mapel',
        'penugasan-guru',
        'migrasi-data',
        'pengaturan-identitas',
        'pengaturan-akademik',
        'log-aktivitas',
      ].includes(view)
    ) {
      return activeRole === 'admin';
    }

    if (
      [
        'supervisi-kbm',
        'monitoring-kbm',
        'pengawasan-nilai',
        'analisis-nilai',
        'pengesahan-rapor',
        'laporan-madrasah',
      ].includes(view)
    ) {
      return activeRole === 'kepala_madrasah' || activeRole === 'admin';
    }

    if (
      [
        'siswa-kelas',
        'perangkat-kelas',
        'monitoring-nilai-mapel',
        'catatan-perkembangan',
        'pengolahan-rapor',
      ].includes(view)
    ) {
      return activeRole === 'wali_kelas' || activeRole === 'admin';
    }

    if (view === 'presensi' || view === 'rekap-presensi-kelas') {
      return activeRole === 'wali_kelas';
    }

    if (
      view === 'bimbingan-siswa' ||
      view === 'kokurikuler' ||
      view.startsWith('kokurikuler-')
    ) {
      return (
        activeRole === 'guru' ||
        activeRole === 'wali_kelas' ||
        activeRole === 'admin' ||
        activeRole === 'kepala_madrasah'
      );
    }

    if (
      view.startsWith('eval-scope:') ||
      [
        'jurnal-mengajar',
        'perencanaan-ajar',
        'arsip-drive',
        'cp',
        'tp',
        'atp',
        'modul-ajar',
        'lkpd',
        'kisi-kisi',
        'soal-asesmen',
        'eval-lm1',
        'eval-lm2',
        'eval-sts',
        'eval-lm3',
        'eval-lm4',
        'eval-sas',
        'supervisi-kbm',
        'supervisi-guru',
        'asesmen-nilai',
        'remedial-pengayaan',
        'analisis-nilai',
        'asisten-ai',
      ].includes(view)
    ) {
      return activeRole === 'guru' || activeRole === 'admin' || activeRole === 'kepala_madrasah';
    }

    if (view === 'penyimpanan-drive') {
      return activeRole === 'admin' || activeRole === 'kepala_madrasah' || activeRole === 'guru';
    }

    return true;
  };

  useEffect(() => {
    void fileStorageService.hydrateConfigFromServer();
  }, []);

  useEffect(() => {
    if (!isAuthorized(activeView)) {
      setActiveView('dashboard');
    }
  }, [activeRole, activeView]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAF9]">
        <div className="w-10 h-10 border-3 border-emerald-700 border-t-amber-400 rounded-full animate-spin" />
        <p className="mt-4 text-xs font-semibold text-emerald-950">
          Memuat SIMPEL MI AL IHSAN...
        </p>
      </div>
    );
  }

  // Jika belum login, tampilkan layar login
  if (!user) {
    return <LoginPage />;
  }

  const renderCurrentView = () => {
    if (!isAuthorized(activeView)) {
      return <AccessDeniedPage onBackToDashboard={() => setActiveView('dashboard')} />;
    }

    if (activeView.startsWith('penugasan-')) {
      return <TeachingAssignmentsPage initialView={activeView} onNavigate={setActiveView} />;
    }

    if (activeView.startsWith('eval-scope:')) {
      return (
        <EvaluationManagementPage
          initialScope={activeView.slice('eval-scope:'.length)}
          defaultTab="kisi-kisi"
          onNavigate={setActiveView}
        />
      );
    }

    switch (activeView) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActiveView} />;

      case 'profil':
        return <ProfilePage />;

      case 'kelola-pengguna':
        return <UserManagementPage />;

      // === TAHAP 4: MODUL ADMINISTRASI & PEMBELAJARAN LENGKAP ===
      case 'master-guru':
        return <TeachersPage />;

      case 'master-siswa':
      case 'siswa-kelas':
        return <StudentsPage onNavigate={setActiveView} />;

      case 'master-kelas':
        return <ClassesPage onNavigate={setActiveView} />;

      case 'perangkat-kelas':
        return <ClassesPage onNavigate={setActiveView} homeroomOnly={activeRole === 'wali_kelas'} />;

      case 'master-mapel':
        return <SubjectsPage />;

      case 'penugasan-guru':
      case 'penugasan-rekap':
        return <TeachingAssignmentsPage initialView={activeView} onNavigate={setActiveView} />;

      case 'pengaturan-akademik':
        return <AcademicSettingsPage />;

      case 'pengaturan-identitas':
        return <InstitutionSettingsPage />;

      case 'migrasi-data':
        return <DataMigrationPage />;

      case 'lapor-kendala':
        return <IssueTrackingPage />;

      case 'pusat-bantuan':
        return <HelpCenterPage />;

      case 'arsip-drive':
        return <CurriculumDocsPage />;

      // === PERANGKAT PEMBELAJARAN AKTIF (CP, TP, ATP, PROTA, PROMES, MODUL AJAR, LKPD) ===
      case 'perangkat-pembelajaran':
      case 'cp':
        return <CurriculumManagementPage defaultTab="cp" onNavigate={setActiveView} />;
      case 'tp':
        return <CurriculumManagementPage defaultTab="tp" onNavigate={setActiveView} />;
      case 'atp':
        return <CurriculumManagementPage defaultTab="atp" onNavigate={setActiveView} />;
      case 'prota':
        return <CurriculumManagementPage defaultTab="prota" onNavigate={setActiveView} />;
      case 'promes':
        return <CurriculumManagementPage defaultTab="promes" onNavigate={setActiveView} />;
      case 'modul-ajar':
        return <CurriculumManagementPage defaultTab="modul-ajar" onNavigate={setActiveView} />;
      case 'lkpd':
        return <CurriculumManagementPage defaultTab="lkpd" onNavigate={setActiveView} />;

      // === PERANGKAT EVALUASI AKTIF PER LINGKUP MATERI (LM) & STS / SAS ===
      case 'eval-lm1':
        return <EvaluationManagementPage initialScope="LM1" defaultTab="kisi-kisi" onNavigate={setActiveView} />;
      case 'eval-lm2':
        return <EvaluationManagementPage initialScope="LM2" defaultTab="kisi-kisi" onNavigate={setActiveView} />;
      case 'eval-sts':
        return <EvaluationManagementPage initialScope="STS" defaultTab="kisi-kisi" onNavigate={setActiveView} />;
      case 'eval-lm3':
        return <EvaluationManagementPage initialScope="LM3" defaultTab="kisi-kisi" onNavigate={setActiveView} />;
      case 'eval-lm4':
        return <EvaluationManagementPage initialScope="LM4" defaultTab="kisi-kisi" onNavigate={setActiveView} />;
      case 'eval-sas':
        return <EvaluationManagementPage initialScope="SAS" defaultTab="kisi-kisi" onNavigate={setActiveView} />;

      // Submenu umum Evaluasi
      case 'kisi-kisi':
        return <EvaluationManagementPage defaultTab="kisi-kisi" onNavigate={setActiveView} />;
      case 'soal-asesmen':
        return <EvaluationManagementPage defaultTab="soal-asesmen" onNavigate={setActiveView} />;
      case 'asesmen-nilai':
      case 'pengawasan-nilai':
        return <EvaluationManagementPage defaultTab="asesmen-nilai" onNavigate={setActiveView} />;
      case 'remedial-pengayaan':
        return <EvaluationManagementPage defaultTab="remedial-pengayaan" onNavigate={setActiveView} />;
      case 'analisis-nilai':
        return <EvaluationManagementPage defaultTab="analisis-nilai" onNavigate={setActiveView} />;

      case 'presensi':
      case 'rekap-presensi-kelas':
        return (
          <AttendancePage
            initialMode={activeView === 'rekap-presensi-kelas' ? 'bulanan' : 'harian'}
            onNavigate={setActiveView}
          />
        );

      case 'kokurikuler':
      case 'kokurikuler-perencanaan':
        return <KoKurikulerPage defaultSubMenu="perencanaan" onNavigate={setActiveView} />;
      case 'kokurikuler-bahan-ajar':
        return <KoKurikulerPage defaultSubMenu="bahan-ajar" onNavigate={setActiveView} />;
      case 'kokurikuler-asesmen':
        return <KoKurikulerPage defaultSubMenu="asesmen" onNavigate={setActiveView} />;
      case 'kokurikuler-administrasi':
        return <KoKurikulerPage defaultSubMenu="administrasi" onNavigate={setActiveView} />;

      case 'monitoring-kbm':
      case 'jurnal-mengajar':
      case 'jurnal-kbm':
        return <TeachingJournalPage onNavigate={setActiveView} />;

      case 'bimbingan-siswa':
        return <StudentGuidancePage />;

      // === SUPERVISI PEMBELAJARAN & KBM (Formulir Langsung, Tabel & Ekspor) ===
      case 'supervisi-kbm':
      case 'supervisi-guru':
        return <SupervisionPage />;

      // === LEGER NILAI & PENGOLAHAN RAPOR MADRASAH ===
      case 'pengolahan-rapor':
      case 'pengesahan-rapor':
      case 'leger-nilai':
      case 'monitoring-nilai-mapel':
      case 'catatan-perkembangan':
        return <GradeLedgerPage onNavigate={setActiveView} />;

      case 'asisten-ai':
      case 'asisten-ai-modul':
      case 'asisten-ai-lkpd':
      case 'asisten-ai-soal':
      case 'asisten-ai-ide':
      case 'asisten-ai-refleksi':
      case 'asisten-ai-analisis':
      case 'asisten-ai-kamad':
      case 'asisten-ai-chat': {
        const tabMap: Record<string, string> = {
          'asisten-ai-modul': 'modul-ajar',
          'asisten-ai-lkpd': 'lkpd',
          'asisten-ai-soal': 'soal-asesmen',
          'asisten-ai-ide': 'ide-pembelajaran',
          'asisten-ai-refleksi': 'refleksi-guru',
          'asisten-ai-analisis': 'analisis-belajar',
          'asisten-ai-kamad': 'kepala-madrasah',
          'asisten-ai-chat': 'tanya-jawab',
        };
        const defaultTab = tabMap[activeView] || 'modul-ajar';
        return <AIAssistantPage initialTab={defaultTab} onNavigate={setActiveView} />;
      }

      case 'penyimpanan-drive':
        return <GoogleDriveStoragePage />;

      case 'log-aktivitas':
      case 'laporan-madrasah':
        return (
          <ModulePlaceholder
            title="Laporan Mutu & Log Aktivitas"
            description="Rekapitulasi log audit aktivitas sistem dan laporan mutu akademik madrasah."
            icon={ClipboardList}
            onBack={() => setActiveView('dashboard')}
          />
        );

      default:
        return <DashboardPage onNavigate={setActiveView} />;
    }
  };

  return (
    <AppLayout activeView={activeView} onNavigate={setActiveView}>
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-8 h-8 border-2 border-emerald-700 border-t-amber-400 rounded-full animate-spin" />
            <p className="mt-3 text-xs font-medium text-emerald-900">Memuat modul...</p>
          </div>
        }
      >
        {renderCurrentView()}
      </Suspense>
    </AppLayout>
  );
};

export default function App() {
  return (
    <SyncProvider>
      <AppSettingsProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <GoogleDriveProvider>
              <MainAppContent />
            </GoogleDriveProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </AppSettingsProvider>
    </SyncProvider>
  );
}
