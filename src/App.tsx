import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { UserManagementPage } from './features/users/UserManagementPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { AccessDeniedPage } from './features/auth/AccessDeniedPage';
import { ModulePlaceholder } from './components/common/ModulePlaceholder';

// Modul Tahap 4: Pembelajaran & Administrasi Akademik
import { AcademicSettingsPage } from './features/academic/AcademicSettingsPage';
import { ClassesPage } from './features/academic/ClassesPage';
import { StudentsPage } from './features/academic/StudentsPage';
import { TeachersPage } from './features/academic/TeachersPage';
import { SubjectsPage } from './features/academic/SubjectsPage';
import { TeachingAssignmentsPage } from './features/academic/TeachingAssignmentsPage';
import { CurriculumDocsPage } from './features/curriculum/CurriculumDocsPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { TeachingJournalPage } from './features/journal/TeachingJournalPage';
import { GradesPage } from './features/assessment/GradesPage';
import { RemedialEnrichmentPage } from './features/assessment/RemedialEnrichmentPage';
import { LearningAnalysisPage } from './features/assessment/LearningAnalysisPage';
import { StudentGuidancePage } from './features/guidance/StudentGuidancePage';
import { SupervisionPage } from './features/supervision/SupervisionPage';
import { CurriculumManagementPage } from './features/curriculum/CurriculumManagementPage';
import { EvaluationManagementPage } from './features/assessment/EvaluationManagementPage';

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-3 border-emerald-800 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-semibold text-slate-600">
          Memuat SIMPEL MI AL IHSAN...
        </p>
      </div>
    );
  }

  // Jika belum login, tampilkan layar login
  if (!user) {
    return <LoginPage />;
  }

  // Pemeriksaan Hak Akses (Route Guard berdasarkan activeRole)
  const isAuthorized = (view: string): boolean => {
    if (view === 'dashboard' || view === 'profil') return true;

    if (
      view.startsWith('penugasan-') ||
      [
        'kelola-pengguna',
        'master-guru',
        'master-siswa',
        'master-kelas',
        'master-mapel',
        'penugasan-guru',
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
        'monitoring-nilai-mapel',
        'rekap-presensi-kelas',
        'catatan-perkembangan',
        'pengolahan-rapor',
      ].includes(view)
    ) {
      return activeRole === 'wali_kelas' || activeRole === 'admin';
    }

    if (
      [
        'presensi',
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
        'bimbingan-siswa',
        'asisten-ai',
      ].includes(view)
    ) {
      return activeRole === 'guru' || activeRole === 'admin' || activeRole === 'kepala_madrasah';
    }

    return true;
  };

  const renderCurrentView = () => {
    if (!isAuthorized(activeView)) {
      return <AccessDeniedPage onBackToDashboard={() => setActiveView('dashboard')} />;
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
        return <StudentsPage />;

      case 'master-kelas':
        return <ClassesPage />;

      case 'master-mapel':
        return <SubjectsPage />;

      case 'penugasan-guru':
      case 'penugasan-cls-1':
      case 'penugasan-cls-2':
      case 'penugasan-cls-3':
      case 'penugasan-cls-4':
      case 'penugasan-cls-5':
      case 'penugasan-cls-6':
      case 'penugasan-rekap':
        return <TeachingAssignmentsPage initialView={activeView} onNavigate={setActiveView} />;

      case 'pengaturan-akademik':
        return <AcademicSettingsPage />;

      case 'arsip-drive':
        return <CurriculumDocsPage />;

      // === PERANGKAT PEMBELAJARAN AKTIF (CP, TP, ATP, MODUL AJAR, LKPD) ===
      case 'cp':
        return <CurriculumManagementPage defaultTab="cp" onNavigate={setActiveView} />;
      case 'tp':
        return <CurriculumManagementPage defaultTab="tp" onNavigate={setActiveView} />;
      case 'atp':
        return <CurriculumManagementPage defaultTab="atp" onNavigate={setActiveView} />;
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
      case 'monitoring-nilai-mapel':
      case 'pengawasan-nilai':
        return <EvaluationManagementPage defaultTab="asesmen-nilai" onNavigate={setActiveView} />;
      case 'remedial-pengayaan':
        return <EvaluationManagementPage defaultTab="remedial-pengayaan" onNavigate={setActiveView} />;
      case 'analisis-nilai':
        return <EvaluationManagementPage defaultTab="analisis-nilai" onNavigate={setActiveView} />;

      case 'presensi':
      case 'monitoring-kbm':
      case 'rekap-presensi-kelas':
        return <AttendancePage />;

      case 'jurnal-mengajar':
        return <TeachingJournalPage />;

      case 'bimbingan-siswa':
        return <StudentGuidancePage />;

      // === SUPERVISI PEMBELAJARAN & KBM (Formulir Langsung, Tabel & Ekspor) ===
      case 'supervisi-kbm':
      case 'supervisi-guru':
        return <SupervisionPage />;

      case 'pengolahan-rapor':
      case 'pengesahan-rapor':
      case 'catatan-perkembangan':
        return (
          <ModulePlaceholder
            title="Pengolahan & Pengesahan Rapor Madrasah"
            stageName="Tahap 8"
            description="Kompilasi nilai akhir seluruh mapel, rumusan deskripsi capaian otomatis, pratinjau rapor, dan cetak PDF."
            icon={FileSpreadsheet}
            onBack={() => setActiveView('dashboard')}
          />
        );

      case 'asisten-ai':
        return (
          <ModulePlaceholder
            title="Asisten Cerdas Gemini API"
            stageName="Tahap 10"
            description="Generator draf Modul Ajar, ATP, rubrik asesmen, dan LKPD dengan enkripsi privasi siswa."
            icon={Sparkles}
            onBack={() => setActiveView('dashboard')}
          />
        );

      case 'log-aktivitas':
      case 'laporan-madrasah':
        return (
          <ModulePlaceholder
            title="Laporan Mutu & Log Aktivitas"
            stageName="Tahap 9"
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
      {renderCurrentView()}
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
