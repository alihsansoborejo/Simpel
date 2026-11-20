import React, { useState, useEffect, useRef } from 'react';
import { attendanceService } from '../../services/attendanceService';
import { academicService } from '../../services/academicService';
import {
  Student,
  ClassRoom,
  AttendanceStatus,
  StudentAttendance,
  ClassMember,
  Teacher,
  SystemSettings,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync, notifyDomFormSaved } from '../../hooks/useRealtimeSync';
import {
  CheckCircle,
  Save,
  Check,
  AlertCircle,
  Printer,
  ShieldCheck,
  School,
  Lock,
  CalendarDays,
  Calendar,
} from 'lucide-react';

interface AttendancePageProps {
  initialMode?: 'harian' | 'bulanan';
  onNavigate?: (view: string) => void;
}

const BULAN_OPTIONS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export const AttendancePage: React.FC<AttendancePageProps> = ({
  initialMode = 'harian',
  onNavigate,
}) => {
  const { user, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'harian' | 'bulanan'>(initialMode);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string>('');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('');
  const [homeroomClassId, setHomeroomClassId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [monthlyRecords, setMonthlyRecords] = useState<StudentAttendance[]>([]);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Map of studentId -> { status: AttendanceStatus, notes: string }
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({});

  const isAttendanceDirtyRef = useRef<boolean>(false);
  const selectedDateRef = useRef<string>(selectedDate);
  selectedDateRef.current = selectedDate;
  const selectedMonthRef = useRef<string>(selectedMonth);
  selectedMonthRef.current = selectedMonth;

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  const loadInitialData = async (silent = false) => {
    if (activeRole !== 'wali_kelas') {
      setHomeroomClassId('');
      setSelectedClassId('');
      setAttendanceMap({});
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [clss, stds, cm, sysSettings, years, sems, teacher] = await Promise.all([
        academicService.getClasses(),
        academicService.getStudents(),
        academicService.getClassMembers(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
      ]);

      setClasses(clss);
      setAllStudents(stds);
      setClassMembers(cm);
      setSettings(sysSettings);
      setResolvedTeacher(teacher);

      const activeYear =
        years.find((y) => y.id === sysSettings.active_academic_year_id) ||
        years.find((y) => y.is_active) ||
        years[0];
      const activeSem =
        sems.find((s) => s.id === sysSettings.active_semester_id) ||
        sems.find((s) => s.is_active) ||
        sems[0];

      setActiveAcademicYearId(activeYear?.id || '');
      setActiveSemesterId(activeSem?.id || '');

      // Kunci ketat ke rombel asuhan wali kelas aktif (tanpa fallback ke kelas lain)
      const hrClass = await academicService.resolveHomeroomClassForUser(user, teacher);
      const userHrClass = hrClass?.id || '';
      setHomeroomClassId(userHrClass);
      setSelectedClassId(userHrClass);

      if (userHrClass) {
        const activeDate = selectedDateRef.current;
        const activeMonth = selectedMonthRef.current;
        await Promise.all([
          !silent || !isAttendanceDirtyRef.current
            ? loadAttendanceForClass(userHrClass, activeDate, stds, cm)
            : Promise.resolve(),
          loadMonthlyAttendance(userHrClass, activeMonth),
        ]);
      } else {
        setAttendanceMap({});
        setMonthlyRecords([]);
      }
    } catch (err) {
      console.error('Gagal memuat data awal presensi:', err);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const loadMonthlyAttendance = async (classId: string, monthPrefix: string) => {
    if (!classId || !monthPrefix) {
      setMonthlyRecords([]);
      return;
    }
    setIsLoadingMonthly(true);
    try {
      const records = await attendanceService.getAttendance({ classId });
      setMonthlyRecords(records.filter((r) => r.date.startsWith(monthPrefix)));
    } catch (err) {
      console.error('Gagal memuat rekap presensi bulanan:', err);
    } finally {
      setIsLoadingMonthly(false);
    }
  };

  const loadAttendanceForClass = async (
    classId: string,
    date: string,
    studentsPool: Student[],
    membersPool: ClassMember[]
  ) => {
    if (!classId) {
      setAttendanceMap({});
      return;
    }
    try {
      // Dapatkan siswa yang terdaftar di rombel ini
      const enrolledStudentIds = membersPool
        .filter((m) => m.class_id === classId)
        .map((m) => m.student_id);

      // Siswa rombel
      const classStudents = studentsPool.filter((s) => enrolledStudentIds.includes(s.id));

      const existing = await attendanceService.getAttendance({
        classId,
        date,
      });

      const initialMap: Record<string, { status: AttendanceStatus; notes: string }> = {};
      classStudents.forEach((s) => {
        const found = existing.find((e) => e.student_id === s.id);
        initialMap[s.id] = {
          status: found ? found.status : 'Hadir',
          notes: found?.notes || '',
        };
      });
      setAttendanceMap(initialMap);
    } catch (err) {
      console.error('Gagal memuat presensi kelas:', err);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, [activeRole, user?.id]);

  useEffect(() => {
    if (selectedClassId && allStudents.length > 0) {
      isAttendanceDirtyRef.current = false;
      void loadAttendanceForClass(selectedClassId, selectedDate, allStudents, classMembers);
    }
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    if (selectedClassId && selectedMonth) {
      void loadMonthlyAttendance(selectedClassId, selectedMonth);
    }
  }, [selectedClassId, selectedMonth]);

  useRealtimeSync(
    [
      'simpel_student_attendance',
      'simpel_attendances',
      'simpel_students',
      'simpel_classes',
      'simpel_class_members',
      'simpel_homeroom_assignments',
      'simpel_teachers',
      'simpel_settings',
      'simpel_academic_years',
      'simpel_semesters',
    ],
    () => {
      void loadInitialData(true);
    }
  );

  // Filter & urutkan siswa khusus rombel asuhan wali kelas aktif
  const targetMembers = classMembers.filter((m) => m.class_id === selectedClassId);
  const memberOrderMap = new Map<string, number>();
  targetMembers.forEach((m, idx) => {
    memberOrderMap.set(m.student_id, m.student_number || idx + 1);
  });
  const targetMemberIds = new Set(targetMembers.map((m) => m.student_id));

  const displayedStudents = selectedClassId
    ? allStudents
        .filter((s) => targetMemberIds.has(s.id))
        .sort((a, b) => {
          const numA = memberOrderMap.get(a.id) ?? 9999;
          const numB = memberOrderMap.get(b.id) ?? 9999;
          if (numA !== numB) return numA - numB;
          return a.full_name.localeCompare(b.full_name, 'id');
        })
    : [];

  const currentClass = classes.find((c) => c.id === selectedClassId) || {
    id: selectedClassId,
    name: selectedClassId ? 'Rombel Asuhan' : 'Belum Ada Rombel Asuhan',
    level: 0,
    phase: 'B' as const,
  };

  const isHomeroomLocked = true;

  const handleMarkAllPresent = () => {
    isAttendanceDirtyRef.current = true;
    const updated: Record<string, { status: AttendanceStatus; notes: string }> = {};
    displayedStudents.forEach((s) => {
      updated[s.id] = {
        status: 'Hadir',
        notes: '',
      };
    });
    setAttendanceMap(updated);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    isAttendanceDirtyRef.current = true;
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    isAttendanceDirtyRef.current = true;
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClassId || displayedStudents.length === 0) return;
    setIsSaving(true);
    try {
      const payload = displayedStudents.map((s) => ({
        studentId: s.id,
        classId: selectedClassId,
        date: selectedDate,
        status: attendanceMap[s.id]?.status || 'Hadir',
        notes: attendanceMap[s.id]?.notes || null,
        recordedBy: user?.id || resolvedTeacher?.id || '',
        academicYearId: activeAcademicYearId || 'ay-2026',
        semesterId: activeSemesterId || 'sem-ganjil-2026',
      }));

      await attendanceService.recordAttendance(payload);
      isAttendanceDirtyRef.current = false;
      notifyDomFormSaved();
      await loadMonthlyAttendance(selectedClassId, selectedMonth);
      setStatusMessage(`Presensi ${currentClass.name} tanggal ${selectedDate} berhasil disimpan ke database.`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menyimpan presensi:', err);
      setStatusMessage('Terjadi kesalahan saat menyimpan presensi.');
    } finally {
      setIsSaving(false);
    }
  };

  const teacherDisplayName = resolvedTeacher
    ? `${resolvedTeacher.title_prefix || ''} ${resolvedTeacher.full_name} ${resolvedTeacher.title_suffix || ''}`.trim()
    : user?.profile?.full_name || 'Wali Kelas';

  // Cetak Dokumen Presensi Siap Cetak
  const handlePrintAttendance = () => {
    const rows = displayedStudents.map((s, idx) => {
      const entry = attendanceMap[s.id] || { status: 'Hadir', notes: '' };
      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center"><strong>${s.full_name}</strong></td>
          <td class="center font-mono">${s.nis}</td>
          <td class="center">${s.gender || '-'}</td>
          <td class="center font-bold" style="${
            entry.status === 'Hadir' ? 'color:#047857;' : entry.status === 'Sakit' ? 'color:#d97706;' : entry.status === 'Izin' ? 'color:#2563eb;' : 'color:#dc2626;'
          }">${entry.status}</td>
          <td>${entry.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Lengkap Peserta Didik</th>
            <th style="width: 90px;">NIS</th>
            <th style="width: 45px;">L/P</th>
            <th style="width: 100px;">Status Kehadiran</th>
            <th>Keterangan / Alasan</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    printDocumentDirectly(contentHtml, {
      title: 'DAFTAR PRESENSI HARIAN PESERTA DIDIK',
      subtitle: `${currentClass.name} (Fase ${currentClass.phase}) - Tanggal: ${selectedDate}`,
      schoolName: settings?.school_name,
      schoolAddress: settings?.address,
      logoUrl: settings?.logo_url || undefined,
      metadata: [
        { label: 'Rombongan Belajar', value: currentClass.name },
        { label: 'Fase Kurikulum', value: `Fase ${currentClass.phase}` },
        { label: 'Tanggal KBM', value: selectedDate },
        { label: 'Tingkat Kehadiran', value: `${hadirPercentage}% (${hadirCount} Hadir)` },
      ],
      extraStyles: `
        th, td { vertical-align: middle !important; }
      `,
      signature: {
        leftTitle: 'Mengetahui,<br>Kepala Madrasah,',
        leftName: settings?.principal_name || 'Kepala Madrasah',
        leftNip: settings?.principal_nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Wali Kelas,',
        rightName: teacherDisplayName,
        rightNip: resolvedTeacher?.nip || '-',
      },
    });
  };

  // Data kalender & matriks rekap bulanan
  const [monthYearNum, monthNum] = selectedMonth.split('-').map((n) => parseInt(n, 10));
  const currentSystemYear = new Date().getFullYear();
  const safeYear = Number.isFinite(monthYearNum) ? monthYearNum : currentSystemYear;
  const safeMonth = Number.isFinite(monthNum) ? monthNum : new Date().getMonth() + 1;
  const selectedYearStr = String(safeYear);
  const selectedMonthStr = String(safeMonth).padStart(2, '0');
  const yearOptions = Array.from(
    new Set([currentSystemYear - 2, currentSystemYear - 1, currentSystemYear, currentSystemYear + 1, currentSystemYear + 2, safeYear])
  ).sort((a, b) => a - b);

  const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSunday = new Date(safeYear, safeMonth - 1, day).getDay() === 0;
    return { day, dateStr, isSunday };
  });

  const monthDisplayName = new Date(safeYear, safeMonth - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  // Peta cepat studentId -> dateStr -> AttendanceStatus
  const buildMonthlySummaryData = (recordsPool: StudentAttendance[]) => {
    const lookup = new Map<string, Map<string, AttendanceStatus>>();
    const datesSet = new Set<string>();
    recordsPool.forEach((rec) => {
      datesSet.add(rec.date);
      if (!lookup.has(rec.student_id)) {
        lookup.set(rec.student_id, new Map<string, AttendanceStatus>());
      }
      lookup.get(rec.student_id)!.set(rec.date, rec.status);
    });

    const summaries = displayedStudents.map((s) => {
      const dayMap = lookup.get(s.id);
      let h = 0;
      let sk = 0;
      let iz = 0;
      let al = 0;
      monthDays.forEach(({ dateStr }) => {
        const st = dayMap?.get(dateStr);
        if (st === 'Hadir') h++;
        else if (st === 'Sakit') sk++;
        else if (st === 'Izin') iz++;
        else if (st === 'Alpa') al++;
      });
      const recordedCount = h + sk + iz + al;
      const pct = recordedCount > 0 ? Math.round((h / recordedCount) * 100) : 0;
      return {
        student: s,
        dayMap,
        hadir: h,
        sakit: sk,
        izin: iz,
        alpa: al,
        recordedCount,
        percentage: pct,
      };
    });

    const totals = summaries.reduce(
      (acc, row) => ({
        hadir: acc.hadir + row.hadir,
        sakit: acc.sakit + row.sakit,
        izin: acc.izin + row.izin,
        alpa: acc.alpa + row.alpa,
        recordedCount: acc.recordedCount + row.recordedCount,
      }),
      { hadir: 0, sakit: 0, izin: 0, alpa: 0, recordedCount: 0 }
    );
    const avgPct =
      totals.recordedCount > 0
        ? Math.round((totals.hadir / totals.recordedCount) * 100)
        : 0;

    return { summaries, totals, avgPct, recordedDatesSet: datesSet };
  };

  const {
    summaries: monthlyStudentSummaries,
    totals: monthlyTotals,
    avgPct: monthlyAvgPercentage,
    recordedDatesSet,
  } = buildMonthlySummaryData(monthlyRecords);

  // Cetak Rekap Presensi Bulanan Rombel (A4 Landscape)
  const handlePrintMonthlyAttendance = async () => {
    let freshMonthRecords = monthlyRecords;
    if (selectedClassId && selectedMonth) {
      try {
        const allRecs = await attendanceService.getAttendance({ classId: selectedClassId });
        freshMonthRecords = allRecs.filter((r) => r.date.startsWith(selectedMonth));
        setMonthlyRecords(freshMonthRecords);
      } catch (err) {
        console.warn('Menggunakan cache rekap bulanan saat cetak:', err);
      }
    }

    const {
      summaries: printSummaries,
      totals: printTotals,
      avgPct: printAvgPercentage,
      recordedDatesSet: printDatesSet,
    } = buildMonthlySummaryData(freshMonthRecords);

    const dayHeaders = monthDays
      .map(
        ({ day, isSunday }) =>
          `<th class="day-col ${isSunday ? 'sun-col' : ''}">${day}</th>`
      )
      .join('');

    const rowsHtml = printSummaries
      .map((item, idx) => {
        const dayCells = monthDays
          .map(({ dateStr, isSunday }) => {
            const st = item.dayMap?.get(dateStr);
            const code = st === 'Hadir' ? 'H' : st === 'Sakit' ? 'S' : st === 'Izin' ? 'I' : st === 'Alpa' ? 'A' : '-';
            const cls =
              st === 'Hadir'
                ? 'st-h'
                : st === 'Sakit'
                ? 'st-s'
                : st === 'Izin'
                ? 'st-i'
                : st === 'Alpa'
                ? 'st-a'
                : 'st-empty';
            return `<td class="center day-cell ${isSunday ? 'sun-col' : ''} ${cls}">${code}</td>`;
          })
          .join('');

        return `
          <tr>
            <td class="center">${idx + 1}</td>
            <td class="center font-mono">${item.student.nis}</td>
            <td class="center name-col"><strong>${item.student.full_name}</strong></td>
            <td class="center">${item.student.gender}</td>
            ${dayCells}
            <td class="center font-bold st-h">${item.hadir}</td>
            <td class="center font-bold st-s">${item.sakit}</td>
            <td class="center font-bold st-i">${item.izin}</td>
            <td class="center font-bold st-a">${item.alpa}</td>
            <td class="center font-bold">${item.recordedCount > 0 ? `${item.percentage}%` : '-'}</td>
          </tr>
        `;
      })
      .join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width: 24px;">No</th>
            <th rowspan="2" style="width: 66px;">NIS</th>
            <th rowspan="2" style="min-width: 150px;">Nama Lengkap Peserta Didik</th>
            <th rowspan="2" style="width: 22px;">L/P</th>
            <th colspan="${daysInMonth}">Tanggal Pertemuan Bulan ${monthDisplayName}</th>
            <th colspan="4">Jumlah</th>
            <th rowspan="2" style="width: 38px;">% H</th>
          </tr>
          <tr>
            ${dayHeaders}
            <th style="width: 22px;">H</th>
            <th style="width: 22px;">S</th>
            <th style="width: 22px;">I</th>
            <th style="width: 22px;">A</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="summary-row">
            <td colspan="${4 + daysInMonth}" class="right"><strong>TOTAL AKUMULASI BULANAN (${printDatesSet.size} Hari Tercatat)</strong></td>
            <td class="center"><strong>${printTotals.hadir}</strong></td>
            <td class="center"><strong>${printTotals.sakit}</strong></td>
            <td class="center"><strong>${printTotals.izin}</strong></td>
            <td class="center"><strong>${printTotals.alpa}</strong></td>
            <td class="center"><strong>${printTotals.recordedCount > 0 ? `${printAvgPercentage}%` : '-'}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="legend-box">
        <strong>Keterangan Kode Status:</strong>
        <span><b>H</b> = Hadir</span> ·
        <span><b>S</b> = Sakit</span> ·
        <span><b>I</b> = Izin</span> ·
        <span><b>A</b> = Alpa (Tanpa Keterangan)</span> ·
        <span><b>-</b> = Belum ada catatan presensi</span> ·
        <span style="color:#991b1b;">Kolom merah muda = Hari Ahad/Minggu</span>
      </div>
    `;

    printDocumentDirectly(contentHtml, {
      title: 'DAFTAR PRESENSI BULANAN PESERTA DIDIK',
      subtitle: `${currentClass.name} (Fase ${currentClass.phase}) — Bulan: ${monthDisplayName}`,
      schoolName: settings?.school_name,
      schoolAddress: settings?.address,
      logoUrl: settings?.logo_url || undefined,
      orientation: 'landscape',
      metadata: [
        { label: 'Rombongan Belajar', value: `${currentClass.name} (Fase ${currentClass.phase})` },
        { label: 'Bulan / Tahun', value: monthDisplayName },
        { label: 'Wali Kelas', value: teacherDisplayName },
        {
          label: 'Rata-rata Kehadiran',
          value:
            printTotals.recordedCount > 0
              ? `${printAvgPercentage}% (${printDatesSet.size} hari tercatat)`
              : `Belum ada entri bulan ${monthDisplayName}`,
        },
      ],
      extraStyles: `
        .kop-container { margin-bottom: 10px; padding-bottom: 6px; }
        .doc-header { margin: 8px 0 10px; }
        .print-meta-grid { margin-bottom: 8px; padding: 6px 10px; font-size: 8.5pt; }
        table { font-size: 7.5pt; margin: 6px 0 8px; }
        th, td { padding: 3px 3px; vertical-align: middle !important; }
        .day-col, .day-cell { width: 17px; min-width: 16px; max-width: 19px; padding: 2px 1px; font-size: 7pt; }
        .name-col { text-align: center; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 175px; }
        .sun-col { background-color: #fee2e2 !important; color: #991b1b; }
        .st-h { color: #065f46; font-weight: bold; }
        .st-s { color: #b45309; font-weight: bold; }
        .st-i { color: #1d4ed8; font-weight: bold; }
        .st-a { color: #be123c; font-weight: bold; }
        .st-empty { color: #94a3b8; }
        .summary-row td { background-color: #f1f5f9 !important; font-size: 8pt; padding: 4px 5px; }
        .legend-box { font-size: 8pt; color: #334155; margin-top: 6px; padding: 5px 8px; border: 1px dashed #cbd5e1; background: #f8fafc; }
        .print-signature-section { margin-top: 16px; font-size: 9pt; }
        .sig-title { margin-bottom: 42px; }
        .sig-space { height: 42px; }
      `,
      signature: {
        leftTitle: 'Mengetahui,<br>Kepala Madrasah,',
        leftName: settings?.principal_name || 'Kepala Madrasah',
        leftNip: settings?.principal_nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Wali Kelas,',
        rightName: teacherDisplayName,
        rightNip: resolvedTeacher?.nip || '-',
      },
    });
  };

  // Hitung statistik hari ini
  const total = displayedStudents.length;
  const hadirCount = displayedStudents.filter((s) => (attendanceMap[s.id]?.status || 'Hadir') === 'Hadir').length;
  const sakitCount = displayedStudents.filter((s) => attendanceMap[s.id]?.status === 'Sakit').length;
  const izinCount = displayedStudents.filter((s) => attendanceMap[s.id]?.status === 'Izin').length;
  const alpaCount = displayedStudents.filter((s) => attendanceMap[s.id]?.status === 'Alpa').length;
  const hadirPercentage = total > 0 ? Math.round((hadirCount / total) * 100) : 0;

  // Presensi siswa hanya muncul dan dapat diakses di dashboard Wali Kelas
  if (activeRole !== 'wali_kelas') {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Presensi Siswa Khusus Dashboard Wali Kelas</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Sesuai ketentuan pengelolaan madrasah, <strong>Presensi Siswa</strong> hanya muncul di{' '}
          <strong>Dashboard Wali Kelas</strong> dan terkunci otomatis pada rombel asuhan masing-masing wali kelas.
          <br /><br />
          Apabila Anda memiliki peran ganda sebagai Wali Kelas, silakan beralih ke peran <strong>Wali Kelas</strong> pada menu pemilih peran di kanan atas.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          {onNavigate && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Kembali ke Beranda
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Presensi Kehadiran Siswa</h1>
            {isHomeroomLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Lock className="w-3 h-3 text-amber-700" />
                <span>Rombel Asuhan Wali Kelas</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan presensi khusus rombongan belajar asuhan Anda ({currentClass.name}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'harian' ? (
            <>
              <button
                onClick={handlePrintAttendance}
                disabled={!homeroomClassId || displayedStudents.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cetak Presensi Harian (Kop Madrasah)"
              >
                <Printer className="w-4 h-4 text-emerald-800" />
                <span>Cetak Harian</span>
              </button>
              <div className="inline-flex items-center gap-1.5 bg-amber-50/80 border border-amber-300 rounded-lg px-2 py-1">
                <select
                  aria-label="Filter bulan cetak presensi"
                  value={selectedMonthStr}
                  onChange={(e) => setSelectedMonth(`${selectedYearStr}-${e.target.value}`)}
                  className="text-xs font-semibold bg-white border border-amber-200 rounded px-2 py-1 text-slate-800 focus:outline-emerald-600"
                >
                  {BULAN_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter tahun cetak presensi"
                  value={selectedYearStr}
                  onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonthStr}`)}
                  className="text-xs font-mono font-semibold bg-white border border-amber-200 rounded px-2 py-1 text-slate-800 focus:outline-emerald-600"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void handlePrintMonthlyAttendance()}
                  disabled={!homeroomClassId || displayedStudents.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cetak Rekap Presensi Bulanan Rombel (A4 Landscape)"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-950" />
                  <span>Cetak Bulanan</span>
                </button>
              </div>
              <button
                onClick={handleMarkAllPresent}
                disabled={!homeroomClassId || displayedStudents.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Tandai Semua Hadir</span>
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={isSaving || !homeroomClassId || displayedStudents.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Presensi'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => void handlePrintMonthlyAttendance()}
              disabled={!homeroomClassId || displayedStudents.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cetak Daftar Presensi Bulanan Rombel (A4 Landscape)"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Cetak Presensi Bulanan ({monthDisplayName})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Mode: Presensi Harian vs Rekap & Cetak Bulanan */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('harian')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'harian'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Input Presensi Harian</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('bulanan');
            if (selectedClassId) {
              void loadMonthlyAttendance(selectedClassId, selectedMonth);
            }
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'bulanan'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Rekap &amp; Cetak Bulanan</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Banner Khusus Wali Kelas */}
      {isHomeroomLocked && !homeroomClassId && (
        <div className="flex items-start gap-2.5 p-3.5 text-xs text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Belum Ada Rombel Binaan Wali Kelas</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Admin belum menetapkan rombongan belajar binaan untuk akun Wali Kelas Anda di menu Penugasan Wali Kelas.
            </p>
          </div>
        </div>
      )}

      {isHomeroomLocked && homeroomClassId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-2.5">
            <School className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold">Rombel Binaan: {currentClass.name} (Fase {currentClass.phase})</span>
              <p className="text-[11px] text-emerald-800">
                Wali Kelas: <strong>{teacherDisplayName}</strong> — Data kehadiran otomatis terekap ke Buku Rapor semester aktif.
              </p>
            </div>
          </div>
          <span className="font-mono tabular-nums font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200 shadow-2xs">
            {displayedStudents.length} Santri Terdaftar
          </span>
        </div>
      )}

      {/* Filter Rombel & Tanggal / Bulan */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Rombel Asuhan:</span>
            <span className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>
                {homeroomClassId
                  ? `${currentClass.name} (Fase ${currentClass.phase})`
                  : 'Belum Ada Rombel Asuhan'}
              </span>
            </span>
          </div>

          {activeTab === 'harian' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDate(val);
                  if (val && val.length >= 7) {
                    setSelectedMonth(val.slice(0, 7));
                  }
                }}
                className="text-xs font-mono tabular-nums px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Bulan yang Dicetak:</span>
              <select
                aria-label="Pilih bulan rekap presensi"
                value={selectedMonthStr}
                onChange={(e) => setSelectedMonth(`${selectedYearStr}-${e.target.value}`)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-semibold text-slate-800"
              >
                {BULAN_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Pilih tahun rekap presensi"
                value={selectedYearStr}
                onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonthStr}`)}
                className="text-xs font-mono tabular-nums px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-semibold text-slate-800"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Ringkasan Statistik */}
        {activeTab === 'harian' ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-600">Kehadiran:</span>
            <span className="font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {hadirPercentage}% Hadir
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-mono tabular-nums">H: {hadirCount}</span>
            <span className="text-slate-500 font-mono tabular-nums">S: {sakitCount}</span>
            <span className="text-slate-500 font-mono tabular-nums">I: {izinCount}</span>
            <span className="text-slate-500 font-mono tabular-nums">A: {alpaCount}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-slate-600">{monthDisplayName}:</span>
            <span className="font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {monthlyAvgPercentage}% Rata-rata Hadir
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 font-mono tabular-nums">
              {recordedDatesSet.size} Hari Tercatat
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-emerald-700 font-mono tabular-nums font-semibold">H: {monthlyTotals.hadir}</span>
            <span className="text-amber-700 font-mono tabular-nums font-semibold">S: {monthlyTotals.sakit}</span>
            <span className="text-blue-700 font-mono tabular-nums font-semibold">I: {monthlyTotals.izin}</span>
            <span className="text-rose-700 font-mono tabular-nums font-semibold">A: {monthlyTotals.alpa}</span>
          </div>
        )}
      </div>

      {activeTab === 'harian' ? (
        /* Tabel Entri Presensi Harian */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                  <th className="py-3 px-4 w-12 text-center align-middle">No</th>
                  <th className="py-3 px-4 text-center align-middle">Nama Lengkap Santri</th>
                  <th className="py-3 px-4 text-center align-middle">NIS</th>
                  <th className="py-3 px-4 w-16 text-center align-middle">L/P</th>
                  <th className="py-3 px-4 text-center align-middle">Status Kehadiran</th>
                  <th className="py-3 px-4 align-middle">Keterangan / Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Memuat presensi siswa...
                    </td>
                  </tr>
                ) : displayedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada siswa yang terdaftar pada {currentClass.name}. Silakan tambahkan siswa di Data Master Siswa atau Pusat Migrasi.
                    </td>
                  </tr>
                ) : (
                  displayedStudents.map((student, idx) => {
                    const entry = attendanceMap[student.id] || { status: 'Hadir', notes: '' };
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center align-middle font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 text-center align-middle">
                          <div className="font-bold text-slate-900">{student.full_name}</div>
                        </td>
                        <td className="py-3 px-4 text-center align-middle font-mono tabular-nums text-slate-600 font-medium">
                          {student.nis}
                        </td>
                        <td className="py-3 px-4 text-center align-middle font-bold text-slate-700">
                          {student.gender}
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as AttendanceStatus[]).map((st) => {
                              const isSelected = entry.status === st;
                              let activeStyle = '';
                              if (st === 'Hadir') activeStyle = 'bg-emerald-800 text-white border-emerald-800';
                              if (st === 'Sakit') activeStyle = 'bg-amber-600 text-white border-amber-600';
                              if (st === 'Izin') activeStyle = 'bg-blue-700 text-white border-blue-700';
                              if (st === 'Alpa') activeStyle = 'bg-rose-700 text-white border-rose-700';

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusChange(student.id, st)}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-all ${
                                    isSelected
                                      ? activeStyle
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder={
                              entry.status === 'Hadir'
                                ? 'Catatan opsional...'
                                : 'Alasan izin/sakit (mis. Demam)...'
                            }
                            value={entry.notes}
                            onChange={(e) => handleNotesChange(student.id, e.target.value)}
                            className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded focus:outline-emerald-600"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tabel Matriks Rekap & Pratinjau Cetak Presensi Bulanan */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-slate-900">
                Matriks Kehadiran Bulanan — {currentClass.name} ({monthDisplayName})
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Menampilkan rekap tanggal 1 s.d. {daysInMonth} sesuai catatan presensi harian yang tersimpan. Klik &ldquo;Cetak Presensi Bulanan&rdquo; untuk format A4 Landscape resmi berkop madrasah.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">H = Hadir</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">S = Sakit</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold">I = Izin</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 font-bold">A = Alpa</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2 px-2 text-center align-middle w-9 border-r border-slate-200">No</th>
                  <th className="py-2 px-2 text-center align-middle w-20 border-r border-slate-200">NIS</th>
                  <th className="py-2 px-2.5 text-center align-middle min-w-[165px] border-r border-slate-200">Nama Santri</th>
                  <th className="py-2 px-1.5 text-center align-middle w-10 border-r border-slate-200">L/P</th>
                  {monthDays.map(({ day, isSunday }) => (
                    <th
                      key={day}
                      className={`py-2 px-1 text-center align-middle w-7 font-mono border-r border-slate-100 ${
                        isSunday ? 'bg-rose-50 text-rose-700' : ''
                      }`}
                    >
                      {day}
                    </th>
                  ))}
                  <th className="py-2 px-1.5 text-center align-middle w-8 bg-emerald-50/70 text-emerald-900 border-l border-slate-200">H</th>
                  <th className="py-2 px-1.5 text-center align-middle w-8 bg-amber-50/70 text-amber-900">S</th>
                  <th className="py-2 px-1.5 text-center align-middle w-8 bg-blue-50/70 text-blue-900">I</th>
                  <th className="py-2 px-1.5 text-center align-middle w-8 bg-rose-50/70 text-rose-900">A</th>
                  <th className="py-2 px-2 text-center align-middle w-12 bg-slate-100 text-slate-800">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading || isLoadingMonthly ? (
                  <tr>
                    <td colSpan={9 + daysInMonth} className="py-8 text-center align-middle text-slate-400">
                      Memuat rekap presensi bulanan...
                    </td>
                  </tr>
                ) : monthlyStudentSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9 + daysInMonth} className="py-8 text-center align-middle text-slate-400">
                      Tidak ada siswa yang terdaftar pada {currentClass.name}.
                    </td>
                  </tr>
                ) : (
                  monthlyStudentSummaries.map((row, idx) => (
                    <tr key={row.student.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-2 text-center align-middle font-mono text-slate-500 border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2 text-center align-middle font-mono text-slate-600 border-r border-slate-200">
                        {row.student.nis}
                      </td>
                      <td className="py-2 px-2.5 text-center align-middle border-r border-slate-200">
                        <div className="font-bold text-slate-900 truncate max-w-[180px] mx-auto">
                          {row.student.full_name}
                        </div>
                      </td>
                      <td className="py-2 px-1.5 text-center align-middle font-bold text-slate-700 border-r border-slate-200">
                        {row.student.gender}
                      </td>
                      {monthDays.map(({ day, dateStr, isSunday }) => {
                        const st = row.dayMap?.get(dateStr);
                        const code =
                          st === 'Hadir'
                            ? 'H'
                            : st === 'Sakit'
                            ? 'S'
                            : st === 'Izin'
                            ? 'I'
                            : st === 'Alpa'
                            ? 'A'
                            : '·';
                        const badgeClass =
                          st === 'Hadir'
                            ? 'text-emerald-700 font-bold'
                            : st === 'Sakit'
                            ? 'text-amber-700 font-bold'
                            : st === 'Izin'
                            ? 'text-blue-700 font-bold'
                            : st === 'Alpa'
                            ? 'text-rose-700 font-bold'
                            : 'text-slate-300';
                        return (
                          <td
                            key={day}
                            className={`py-2 px-1 text-center align-middle font-mono border-r border-slate-100 ${
                              isSunday ? 'bg-rose-50/60' : ''
                            } ${badgeClass}`}
                          >
                            {code}
                          </td>
                        );
                      })}
                      <td className="py-2 px-1.5 text-center align-middle font-mono font-bold text-emerald-800 bg-emerald-50/40 border-l border-slate-200">
                        {row.hadir}
                      </td>
                      <td className="py-2 px-1.5 text-center align-middle font-mono font-bold text-amber-800 bg-amber-50/40">
                        {row.sakit}
                      </td>
                      <td className="py-2 px-1.5 text-center align-middle font-mono font-bold text-blue-800 bg-blue-50/40">
                        {row.izin}
                      </td>
                      <td className="py-2 px-1.5 text-center align-middle font-mono font-bold text-rose-800 bg-rose-50/40">
                        {row.alpa}
                      </td>
                      <td className="py-2 px-2 text-center align-middle font-mono font-bold text-slate-800 bg-slate-50">
                        {row.recordedCount > 0 ? `${row.percentage}%` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
