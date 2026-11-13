/**
 * Utility untuk membersihkan seluruh sisa cache data dummy di browser localStorage,
 * menyisakan 1 akun Administrator Madrasah (alihsansoborejo@gmail.com) dan struktur master kelas/mapel.
 */

const PURGE_FLAG_KEY = 'simpel_data_purged_sole_admin_v4';

export function runDataPurgeIfNecessary(): void {
  try {
    const isPurged = localStorage.getItem(PURGE_FLAG_KEY);
    if (isPurged === 'true') {
      return;
    }

    // Jika perangkat baru ini baru saja menarik data/akun tersinkron dari server atau Supabase,
    // JANGAN menimpa cache dengan data kosong dan JANGAN otomatis login sebagai Administrator!
    let hasSyncedData = false;
    try {
      const existingUsersRaw = localStorage.getItem('simpel_users_cache_v2');
      if (existingUsersRaw) {
        const parsedUsers = JSON.parse(existingUsersRaw);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 1) {
          hasSyncedData = true;
        }
      }
      if (!hasSyncedData) {
        for (const checkKey of ['simpel_teachers', 'simpel_students', 'simpel_assessments', 'simpel_teaching_journals']) {
          const raw = localStorage.getItem(checkKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              hasSyncedData = true;
              break;
            }
          }
        }
      }
      if (!hasSyncedData) {
        const settingsRaw = localStorage.getItem('simpel_settings');
        if (settingsRaw && settingsRaw.includes('data:image/')) {
          hasSyncedData = true;
        }
      }
    } catch {
      // ignore parse errors
    }

    if (hasSyncedData) {
      localStorage.setItem(PURGE_FLAG_KEY, 'true');
      return;
    }

    // 1. Kosongkan seluruh data operasional (Array kosong)
    const emptyArrayKeys = [
      'simpel_students',
      'simpel_teachers',
      'simpel_assignments',
      'simpel_class_members',
      'simpel_attendances',
      'simpel_student_attendance',
      'simpel_teaching_journals',
      'simpel_assessments',
      'simpel_grades',
      'simpel_remedial',
      'simpel_enrichment',
      'simpel_student_guidance',
      'simpel_supervision_records',
      'simpel_curriculum_documents',
      'simpel_curriculum_reviews',
      'simpel_homeroom_assignments',
      'simpel_activity_logs',
      'simpel_ai_drafts',
      'simpel_mi_issue_reports',
    ];

    emptyArrayKeys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify([]));
    });

    // 2. Kosongkan leger dan kunci nilai rapor (Object kosong)
    localStorage.setItem('simpel_subject_ledger_v1', JSON.stringify({}));
    localStorage.setItem('simpel_report_card_locks_v1', JSON.stringify({}));

    // 3. Reset daftar rombel kelas agar wali_kelas_id kembali null (belum ditugaskan guru)
    const baseClasses = [
      { id: 'cls-1', level: 1, name: 'Kelas 1', phase: 'A', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
      { id: 'cls-2', level: 2, name: 'Kelas 2', phase: 'A', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
      { id: 'cls-3', level: 3, name: 'Kelas 3', phase: 'B', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
      { id: 'cls-4', level: 4, name: 'Kelas 4', phase: 'B', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
      { id: 'cls-5', level: 5, name: 'Kelas 5', phase: 'C', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
      { id: 'cls-6', level: 6, name: 'Kelas 6', phase: 'C', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
    ];
    localStorage.setItem('simpel_classes', JSON.stringify(baseClasses));

    // 4. Pastikan data akun di User Management hanya memiliki 1 Administrator
    const soleAdmin = {
      id: 'usr-admin-1',
      email: 'alihsansoborejo@gmail.com',
      full_name: 'Administrator Madrasah',
      phone_number: '081234567800',
      avatar_url: null,
      is_active: true,
      created_at: '2026-07-01T08:00:00+07:00',
      roles: ['admin'],
      teacher_info: null,
    };
    localStorage.setItem('simpel_users_cache_v2', JSON.stringify([soleAdmin]));

    // 5. Set sesi aktif pengguna ke 1 Administrator
    const currentSessionRaw = localStorage.getItem('simpel_mi_session_user');
    let needsSessionReset = true;
    if (currentSessionRaw) {
      try {
        const parsed = JSON.parse(currentSessionRaw);
        if (parsed?.email === 'alihsansoborejo@gmail.com' && parsed?.roles?.includes('admin')) {
          needsSessionReset = false;
        }
      } catch {}
    }

    if (needsSessionReset) {
      const adminSession = {
        id: 'usr-admin-1',
        email: 'alihsansoborejo@gmail.com',
        profile: {
          id: 'usr-admin-1',
          email: 'alihsansoborejo@gmail.com',
          full_name: 'Administrator Madrasah',
          phone_number: '081234567800',
          avatar_url: null,
          is_active: true,
          created_at: '2026-07-01T08:00:00+07:00',
          updated_at: '2026-11-10T12:00:00+07:00',
        },
        roles: ['admin'],
        activeRole: 'admin',
        teacherId: null,
        homeroomClassId: null,
      };
      localStorage.setItem('simpel_mi_session_user', JSON.stringify(adminSession));
    }

    // Tandai bahwa pembersihan tuntas
    localStorage.setItem(PURGE_FLAG_KEY, 'true');
  } catch (err) {
    console.warn('Dummy data purge error:', err);
  }
}
