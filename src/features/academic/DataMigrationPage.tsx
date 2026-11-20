import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  Users,
  GraduationCap,
  School,
  BookOpen,
} from 'lucide-react';
import { academicService, parseClassLevelFromInput, normalizePersonName } from '../../services/academicService';
import { createUserWithRoles } from '../../services/userService';
import { ClassRoom, Subject } from '../../types/database.types';

type ImportCategory = 'guru' | 'siswa' | 'kelas' | 'mapel' | 'penugasan';

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  resolvedClassName?: string;
  resolvedClassId?: string;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeaderKey(header: string): string {
  return header
    .replace(/^["'\uFEFF]+|["']+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickField(normMap: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const val = normMap[alias];
    if (val !== undefined && val !== '') return val.trim();
  }
  return '';
}

export const DataMigrationPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ImportCategory>('siswa');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showConfirmCommit, setShowConfirmCommit] = useState<boolean>(false);
  const [isCommitted, setIsCommitted] = useState<boolean>(false);
  const [commitSummary, setCommitSummary] = useState<{
    total: number;
    success: number;
    failed: number;
    placedInClass?: number;
    details?: string[];
  } | null>(null);

  // Download official CSV template
  const downloadTemplate = (category: ImportCategory) => {
    let headers: string[] = [];
    let sampleRows: string[][] = [];
    let filename = '';

    if (category === 'guru') {
      filename = 'template_impor_guru_mi_alihsan.csv';
      headers = ['Gelar_Depan', 'Nama_Lengkap', 'Gelar_Belakang', 'NIP', 'NUPTK', 'JK', 'Telepon', 'Spesialisasi', 'Email_Akun'];
      sampleRows = [
        ['Ust.', 'Ahmad Fauzi', 'S.Pd.I', '198503122019031008', '4532763665200023', 'L', '081234567890', 'Guru Kelas 4 & PAI', 'ahmad.fauzi@alihsan.sch.id'],
        ['Usth.', 'Siti Nurhaliza', 'M.Pd.', '', '9876543210123456', 'P', '085712345678', 'Matematika & IPAS', 'siti.nurhaliza@alihsan.sch.id'],
      ];
    } else if (category === 'siswa') {
      filename = 'template_impor_siswa_mi_alihsan.csv';
      headers = ['NIS', 'NISN', 'Nama_Lengkap', 'Nama_Panggilan', 'Tingkat_Kelas', 'JK', 'Tempat_Lahir', 'Tanggal_Lahir_YYYY_MM_DD', 'Nama_Orang_Tua', 'No_HP_Wali', 'Alamat'];
      sampleRows = [
        ['260101', '0165678901', 'Ahmad Zidan Al-Farisi', 'Zidan', '1', 'L', 'Temanggung', '2019-04-12', 'Bambang Sutrisno', '08122334455', 'Soborejo RT 02 RW 01, Pringsurat'],
        ['260102', '0165678902', 'Aisyah Putri Ramadhani', 'Aisyah', '1', 'P', 'Temanggung', '2019-08-25', 'Agus Supriyanto', '08577889900', 'Soborejo RT 01 RW 02, Pringsurat'],
      ];
    } else if (category === 'kelas') {
      filename = 'template_impor_kelas_mi_alihsan.csv';
      headers = ['Tingkat_Kelas', 'Nama_Rombel', 'Fase', 'Kapasitas', 'Wali_Kelas'];
      sampleRows = [
        ['1', 'Kelas 1', 'A', '28', ''],
        ['2', 'Kelas 2', 'A', '28', ''],
        ['3', 'Kelas 3', 'B', '28', ''],
        ['4', 'Kelas 4', 'B', '28', ''],
        ['5', 'Kelas 5', 'C', '28', ''],
        ['6', 'Kelas 6', 'C', '28', ''],
      ];
    } else if (category === 'mapel') {
      filename = 'template_impor_mata_pelajaran_mi_alihsan.csv';
      headers = ['Kode_Mapel', 'Nama_Mata_Pelajaran', 'Kelompok', 'Urutan'];
      sampleRows = [
        ['IND', 'Bahasa Indonesia', 'Umum', '7'],
        ['MTK', 'Matematika', 'Umum', '8'],
        ['IPAS', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', 'Umum', '9'],
        ['AA', 'Akidah Akhlak', 'PAI', '2'],
        ['FIQ', 'Fikih', 'PAI', '3'],
        ['ASW', "Ke-NU-an / Aswaja (Khas Ma'arif)", "Khas Ma'arif", '12'],
      ];
    } else if (category === 'penugasan') {
      filename = 'template_impor_penugasan_guru.csv';
      headers = ['Nama_Rombel', 'Kode_Mapel', 'Nama_Guru', 'Tahun_Pelajaran'];
      sampleRows = [
        ['Kelas 4', 'IND', 'Ahmad Fauzi', '2026/2027'],
        ['Kelas 4', 'IPAS', 'Siti Nurhaliza', '2026/2027'],
      ];
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsCommitted(false);
    setCommitSummary(null);
    setParseError(null);
    setShowConfirmCommit(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = (event.target?.result as string) || '';
      await parseCSV(text, selectedCategory);
    };
    reader.readAsText(uploadedFile);
  };

  const resolveClassFromRow = (rawClassInput: string, availableClasses: ClassRoom[]): ClassRoom | null => {
    const trimmed = rawClassInput.trim();
    if (!trimmed) return null;

    // 1. Cocokkan nama persis (e.g. "Kelas 1", "Kelas 1A")
    const byExactName = availableClasses.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (byExactName) return byExactName;

    // 2. Cocokkan ID persis (e.g. "cls-1")
    const byId = availableClasses.find((c) => c.id === trimmed);
    if (byId) return byId;

    // 3. Cocokkan tingkat angka / romawi (e.g. "1", "Kelas 1", "1A", "I")
    const lvl = parseClassLevelFromInput(trimmed);
    if (lvl !== null) {
      const byLevel = availableClasses.find((c) => c.level === lvl);
      if (byLevel) return byLevel;
    }

    return null;
  };

  const parseCSV = async (rawContent: string, category: ImportCategory) => {
    const content = rawContent.replace(/^\uFEFF/, '');
    const lines = content.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      setParsedRows([]);
      setParseError('Berkas CSV kosong atau hanya memiliki baris tajuk (header).');
      return;
    }

    // Auto-detect delimiter (, ; or tab)
    const headerLine = lines[0];
    const commaCount = splitDelimitedLine(headerLine, ',').length;
    const semiCount = splitDelimitedLine(headerLine, ';').length;
    const tabCount = splitDelimitedLine(headerLine, '\t').length;
    const delimiter =
      semiCount > commaCount && semiCount >= tabCount
        ? ';'
        : tabCount > commaCount && tabCount > semiCount
          ? '\t'
          : ',';

    const rawHeaders = splitDelimitedLine(headerLine, delimiter);
    const normHeaders = rawHeaders.map(normalizeHeaderKey);

    const availableClasses = await academicService.getClasses();
    const rows: ParsedRow[] = [];
    const seenIdentifiers = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = splitDelimitedLine(lines[i], delimiter);
      const rowData: Record<string, string> = {};
      const normMap: Record<string, string> = {};

      rawHeaders.forEach((h, idx) => {
        const cleanVal = (cols[idx] || '').replace(/^"|"$/g, '').trim();
        rowData[h.trim()] = cleanVal;
        normMap[normHeaders[idx]] = cleanVal;
      });

      const messages: string[] = [];
      let status: 'valid' | 'warning' | 'error' = 'valid';
      let resolvedClassName: string | undefined;
      let resolvedClassId: string | undefined;

      if (category === 'siswa') {
        const nis = pickField(normMap, ['nis', 'no_induk', 'nomor_induk']);
        const nisn = pickField(normMap, ['nisn']);
        const nama = pickField(normMap, ['nama_lengkap', 'nama', 'full_name', 'nama_siswa']);
        const jk = pickField(normMap, ['jk', 'jenis_kelamin', 'gender', 'l_p']);
        let rawKelas = pickField(normMap, [
          'tingkat_kelas',
          'tingkat_rombel',
          'tingkat',
          'kelas',
          'rombel',
          'nama_rombel',
          'kelas_rombel',
          'nama_kelas',
          'rombel_tujuan',
          'kelas_siswa',
          'kls',
        ]);
        if (!rawKelas) {
          const fallbackEntry = Object.entries(normMap).find(
            ([k, v]) => v && (k.includes('rombel') || k.includes('kelas'))
          );
          if (fallbackEntry) rawKelas = fallbackEntry[1].trim();
        }

        // Simpan nilai terstandar agar commit selalu akurat
        rowData.__nis = nis;
        rowData.__nisn = nisn;
        rowData.__nama = nama;
        rowData.__panggilan = pickField(normMap, ['nama_panggilan', 'panggilan', 'nickname']);
        rowData.__jk = jk;
        rowData.__tempat_lahir = pickField(normMap, ['tempat_lahir', 'birth_place']);
        rowData.__tanggal_lahir = pickField(normMap, [
          'tanggal_lahir_yyyy_mm_dd',
          'tanggal_lahir',
          'tgl_lahir',
          'birth_date',
        ]);
        rowData.__orang_tua = pickField(normMap, ['nama_orang_tua', 'nama_wali', 'orang_tua', 'wali']);
        rowData.__hp_wali = pickField(normMap, ['no_hp_wali', 'hp_wali', 'telepon', 'no_hp', 'wa']);
        rowData.__alamat = pickField(normMap, ['alamat', 'address']);
        rowData.__raw_kelas = rawKelas;

        if (!nis || !nama) {
          status = 'error';
          messages.push('NIS dan Nama Lengkap wajib diisi.');
        }

        if (!rawKelas) {
          status = status === 'error' ? 'error' : 'warning';
          messages.push('Kolom Tingkat_Kelas / Rombel kosong (siswa tidak akan otomatis masuk ke rombel).');
        } else {
          const matchedClass = resolveClassFromRow(rawKelas, availableClasses);
          const parsedLvl = parseClassLevelFromInput(rawKelas);
          if (matchedClass) {
            resolvedClassId = matchedClass.id;
            resolvedClassName = matchedClass.name;
          } else if (parsedLvl !== null) {
            const cleanName = /^\d+$/.test(rawKelas.trim()) || /^[ivx]+$/i.test(rawKelas.trim())
              ? `Kelas ${parsedLvl}`
              : rawKelas.trim();
            resolvedClassName = cleanName;
          } else {
            status = 'error';
            messages.push(`Tingkat/Rombel "${rawKelas}" tidak valid. Gunakan angka 1 s.d. 6 atau "Kelas 1" s.d. "Kelas 6".`);
          }
        }

        if (nisn && nisn.length !== 10) {
          if (status === 'valid') status = 'warning';
          messages.push('NISN standar harus 10 digit angka.');
        }

        if (jk && !['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(jk.toUpperCase())) {
          status = 'error';
          messages.push('Jenis Kelamin harus L atau P.');
        }

        if (seenIdentifiers.has(nis)) {
          status = 'error';
          messages.push(`Duplikasi NIS (${nis}) terdeteksi pada baris ini.`);
        } else if (nis) {
          seenIdentifiers.add(nis);
        }
      } else if (category === 'guru') {
        const nama = pickField(normMap, ['nama_lengkap', 'nama', 'full_name', 'nama_guru']);
        rowData.__gelar_depan = pickField(normMap, ['gelar_depan', 'prefix']);
        rowData.__nama = nama;
        rowData.__gelar_belakang = pickField(normMap, ['gelar_belakang', 'suffix']);
        rowData.__nip = pickField(normMap, ['nip']);
        rowData.__nuptk = pickField(normMap, ['nuptk']);
        rowData.__jk = pickField(normMap, ['jk', 'jenis_kelamin', 'gender']);
        rowData.__telepon = pickField(normMap, ['telepon', 'no_hp', 'hp', 'wa']);
        rowData.__spesialisasi = pickField(normMap, ['spesialisasi', 'bidang', 'mapel']);
        rowData.__email = pickField(normMap, ['email_akun', 'email', 'username']);

        if (!nama) {
          status = 'error';
          messages.push('Nama Lengkap guru wajib diisi.');
        }
      } else if (category === 'kelas') {
        const rawLevel = pickField(normMap, ['tingkat_kelas', 'tingkat', 'level']);
        const namaRombel = pickField(normMap, ['nama_rombel', 'nama_kelas', 'nama', 'rombel']);
        const parsedLvl = parseClassLevelFromInput(rawLevel || namaRombel);

        rowData.__level = parsedLvl ? String(parsedLvl) : '';
        rowData.__nama_rombel = namaRombel || (parsedLvl ? `Kelas ${parsedLvl}` : '');
        rowData.__fase = pickField(normMap, ['fase', 'phase']).toUpperCase();
        rowData.__kapasitas = pickField(normMap, ['kapasitas', 'capacity']) || '28';
        rowData.__wali_kelas = pickField(normMap, ['wali_kelas', 'nama_wali_kelas', 'guru_wali']);

        if (!parsedLvl) {
          status = 'error';
          messages.push('Tingkat Kelas harus angka 1 s.d. 6.');
        }
      } else if (category === 'mapel') {
        const kode = pickField(normMap, ['kode_mapel', 'kode', 'code']);
        const namaMapel = pickField(normMap, ['nama_mata_pelajaran', 'nama_mapel', 'nama']);
        rowData.__kode = kode;
        rowData.__nama = namaMapel;
        rowData.__kelompok = pickField(normMap, ['kelompok', 'kategori', 'category']) || 'Umum';
        rowData.__urutan = pickField(normMap, ['urutan', 'order_index']) || '15';

        if (!kode || !namaMapel) {
          status = 'error';
          messages.push('Kode Mapel dan Nama Mata Pelajaran wajib diisi.');
        }
      } else if (category === 'penugasan') {
        const rombel = pickField(normMap, ['nama_rombel', 'kelas', 'tingkat_kelas', 'rombel']);
        const kodeMapel = pickField(normMap, ['kode_mapel', 'mapel', 'nama_mapel']);
        const namaGuru = pickField(normMap, ['nama_guru', 'guru', 'pengampu']);
        rowData.__rombel = rombel;
        rowData.__mapel = kodeMapel;
        rowData.__guru = namaGuru;

        const matchedClass = resolveClassFromRow(rombel, availableClasses);
        if (matchedClass) {
          resolvedClassId = matchedClass.id;
          resolvedClassName = matchedClass.name;
        } else {
          status = 'error';
          messages.push(`Rombel "${rombel}" tidak ditemukan.`);
        }
        if (!kodeMapel || !namaGuru) {
          status = 'error';
          messages.push('Kode Mapel dan Nama Guru wajib diisi.');
        }
      }

      rows.push({
        rowNumber: i,
        data: rowData,
        resolvedClassId,
        resolvedClassName,
        status,
        messages,
      });
    }

    setParsedRows(rows);
  };

  // Commit valid records into academicService / Supabase
  const handleCommitImport = async () => {
    const validRows = parsedRows.filter((r) => r.status !== 'error');
    if (validRows.length === 0) {
      setParseError('Tidak ada baris data valid untuk diimpor. Perbaiki baris bertanda merah terlebih dahulu.');
      return;
    }

    setShowConfirmCommit(false);
    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;
    let placedInClassCount = 0;
    const errorDetails: string[] = [];

    try {
      const [existingStudents, existingClasses, existingTeachers, existingSubjects, ctx] = await Promise.all([
        academicService.getStudents(),
        academicService.getClasses(),
        academicService.getTeachers(),
        academicService.getSubjects(),
        academicService.resolveActiveAcademicContext(),
      ]);

      for (const row of validRows) {
        try {
          if (selectedCategory === 'siswa') {
            const nisVal = (row.data.__nis || row.data['NIS'] || '').trim();
            const rawNisn = (row.data.__nisn || row.data['NISN'] || '').trim();
            const studentPayload = {
              nis: nisVal,
              nisn: rawNisn || null,
              full_name: row.data.__nama || row.data['Nama_Lengkap'] || '',
              nickname: row.data.__panggilan || row.data['Nama_Panggilan'] || null,
              gender: ((row.data.__jk || row.data['JK'] || 'L').toUpperCase().startsWith('P') ? 'P' : 'L') as 'L' | 'P',
              birth_place: row.data.__tempat_lahir || row.data['Tempat_Lahir'] || 'Temanggung',
              birth_date: row.data.__tanggal_lahir || row.data['Tanggal_Lahir_YYYY_MM_DD'] || '2016-01-01',
              parent_guardian_name: row.data.__orang_tua || row.data['Nama_Orang_Tua'] || null,
              parent_phone: row.data.__hp_wali || row.data['No_HP_Wali'] || null,
              address: row.data.__alamat || row.data['Alamat'] || 'Soborejo, Pringsurat',
              is_active: true,
            };

            const existingByNis = existingStudents.find((s) => s.nis.trim() === nisVal);
            const savedStudent = existingByNis
              ? await academicService.updateStudent(existingByNis.id, studentPayload)
              : await academicService.createStudent(studentPayload);

            const idxInExisting = existingStudents.findIndex(
              (s) => s.id === savedStudent.id || s.nis.trim() === savedStudent.nis.trim()
            );
            if (idxInExisting >= 0) {
              existingStudents[idxInExisting] = savedStudent;
            } else {
              existingStudents.push(savedStudent);
            }

            // Tempatkan otomatis ke rombel sesuai data CSV (buat rombel otomatis bila belum tersedia di master)
            const targetClassRef = (row.data.__raw_kelas || row.resolvedClassName || row.resolvedClassId || '').trim();
            if (targetClassRef) {
              let matchedCls = await academicService.resolveClassTarget(
                row.resolvedClassId || targetClassRef,
                existingClasses
              );
              if (!matchedCls && targetClassRef) {
                matchedCls = await academicService.resolveClassTarget(targetClassRef, existingClasses);
              }
              if (!matchedCls) {
                const inferredLevel = parseClassLevelFromInput(targetClassRef);
                if (inferredLevel !== null) {
                  const defaultPhase: 'A' | 'B' | 'C' =
                    inferredLevel <= 2 ? 'A' : inferredLevel <= 4 ? 'B' : 'C';
                  const className =
                    /^\d+$/.test(targetClassRef) || /^[ivx]+$/i.test(targetClassRef)
                      ? `Kelas ${inferredLevel}`
                      : targetClassRef;
                  matchedCls = await academicService.createClass({
                    name: className,
                    level: inferredLevel,
                    phase: defaultPhase,
                    capacity: 28,
                    homeroom_teacher_id: null,
                  });
                  existingClasses.push(matchedCls);
                }
              }

              if (matchedCls) {
                await academicService.assignStudentToClass(savedStudent.id, matchedCls.id, ctx.academicYearId);
                placedInClassCount++;
              } else {
                errorDetails.push(
                  `Baris #${row.rowNumber} (${savedStudent.full_name}): rombel "${targetClassRef}" tidak dapat dipetakan.`
                );
              }
            }

            successCount++;
          } else if (selectedCategory === 'guru') {
            const email = row.data.__email || row.data['Email_Akun']?.trim();
            const fullName = row.data.__nama || row.data['Nama_Lengkap'];
            const jk = ((row.data.__jk || row.data['JK'] || 'L').toUpperCase().startsWith('P') ? 'P' : 'L') as 'L' | 'P';

            if (email) {
              await createUserWithRoles({
                email,
                full_name: fullName,
                password: 'AlIhsan2026!',
                title_prefix: row.data.__gelar_depan || undefined,
                title_suffix: row.data.__gelar_belakang || undefined,
                nip: row.data.__nip || undefined,
                nuptk: row.data.__nuptk || undefined,
                gender: jk,
                phone_number: row.data.__telepon || undefined,
                specialization: row.data.__spesialisasi || undefined,
                roles: ['guru'],
                is_active: true,
              });
            } else {
              await academicService.createTeacher({
                user_id: null,
                title_prefix: row.data.__gelar_depan || null,
                full_name: fullName,
                title_suffix: row.data.__gelar_belakang || null,
                nip: row.data.__nip || null,
                nuptk: row.data.__nuptk || null,
                gender: jk,
                phone_number: row.data.__telepon || null,
                specialization: row.data.__spesialisasi || null,
                is_active: true,
              });
            }
            successCount++;
          } else if (selectedCategory === 'kelas') {
            const levelNum = Number(row.data.__level);
            const rombelName = row.data.__nama_rombel || `Kelas ${levelNum}`;
            const defaultPhase: 'A' | 'B' | 'C' = levelNum <= 2 ? 'A' : levelNum <= 4 ? 'B' : 'C';
            const fase = ['A', 'B', 'C'].includes(row.data.__fase)
              ? (row.data.__fase as 'A' | 'B' | 'C')
              : defaultPhase;
            const kapasitas = Number(row.data.__kapasitas) || 28;
            const waliInput = row.data.__wali_kelas || '';
            const matchedWali = waliInput
              ? existingTeachers.find(
                  (t) =>
                    normalizePersonName(t.full_name) === normalizePersonName(waliInput) ||
                    (t.nip && t.nip.trim() === waliInput.trim())
                )
              : undefined;

            const existingCls = existingClasses.find(
              (c) => c.name.toLowerCase() === rombelName.toLowerCase() || c.level === levelNum
            );

            if (existingCls) {
              await academicService.updateClass(existingCls.id, {
                name: rombelName,
                level: levelNum,
                phase: fase,
                capacity: kapasitas,
                ...(matchedWali ? { homeroom_teacher_id: matchedWali.id } : {}),
              });
            } else {
              const createdCls = await academicService.createClass({
                name: rombelName,
                level: levelNum,
                phase: fase,
                capacity: kapasitas,
                homeroom_teacher_id: matchedWali?.id || null,
              });
              existingClasses.push(createdCls);
            }
            successCount++;
          } else if (selectedCategory === 'mapel') {
            const kode = row.data.__kode;
            const namaMapel = row.data.__nama;
            const rawCat = row.data.__kelompok;
            let category: Subject['category'] = 'Umum';
            if (/pai|agama|kemenag/i.test(rawCat)) category = 'PAI';
            else if (/ma'?arif|aswaja|nu/i.test(rawCat)) category = "Khas Ma'arif";
            else if (/mulok|lokal/i.test(rawCat)) category = 'Muatan Lokal';

            const exists = existingSubjects.find(
              (s) => s.code.toLowerCase() === kode.toLowerCase()
            );
            if (!exists) {
              const createdSbj = await academicService.createSubject({
                code: kode.toUpperCase(),
                name: namaMapel,
                category,
                order_index: Number(row.data.__urutan) || existingSubjects.length + 1,
              });
              existingSubjects.push(createdSbj);
            }
            successCount++;
          } else if (selectedCategory === 'penugasan') {
            const cls = await academicService.resolveClassTarget(row.resolvedClassId || row.data.__rombel, existingClasses);
            const sbj = existingSubjects.find(
              (s) =>
                s.code.toLowerCase() === row.data.__mapel.toLowerCase() ||
                s.name.toLowerCase() === row.data.__mapel.toLowerCase()
            );
            const tch = existingTeachers.find(
              (t) =>
                normalizePersonName(t.full_name) === normalizePersonName(row.data.__guru) ||
                normalizePersonName(`${t.title_prefix || ''} ${t.full_name} ${t.title_suffix || ''}`).includes(
                  normalizePersonName(row.data.__guru)
                )
            );

            if (!cls || !sbj || !tch) {
              throw new Error(
                `Baris ${row.rowNumber}: ${!cls ? 'Rombel' : !sbj ? 'Mapel' : 'Guru'} tidak ditemukan di master.`
              );
            }
            await academicService.upsertTeachingAssignment(
              cls.id,
              sbj.id,
              tch.id,
              ctx.academicYearId,
              ctx.semesterId
            );
            successCount++;
          }
        } catch (err: any) {
          console.error('Row insert error:', err);
          failCount++;
          errorDetails.push(err?.message || `Baris #${row.rowNumber} gagal disimpan.`);
        }
      }

      setIsCommitted(true);
      setCommitSummary({
        total: validRows.length,
        success: successCount,
        failed: failCount,
        placedInClass: placedInClassCount,
        details: errorDetails,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('simpel:remote-sync', {
            detail: {
              keys: [
                'simpel_students',
                'simpel_classes',
                'simpel_class_members',
                'simpel_teachers',
                'simpel_subjects',
                'simpel_assignments',
              ],
            },
          })
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const errorCount = parsedRows.filter((r) => r.status === 'error').length;
  const warningCount = parsedRows.filter((r) => r.status === 'warning').length;
  const validCount = parsedRows.filter((r) => r.status === 'valid').length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
          <span>Pusat Migrasi & Impor Data Massal (Excel / CSV)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Mekanisme resmi pengisian data awal operasional madrasah (Guru, Siswa, Rombel, Mapel, dan Penugasan) dengan validasi baris, pemetaan rombel otomatis, dan pratinjau sebelum disimpan.
        </p>
      </div>

      {/* Kategori Pilihan */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: 'siswa', label: 'Data Siswa', icon: Users, desc: 'NIS & Rombel 1-6' },
          { id: 'guru', label: 'Data Guru', icon: GraduationCap, desc: 'Pendidik & Gelar' },
          { id: 'kelas', label: 'Data Rombel', icon: School, desc: 'Kelas & Wali Kelas' },
          { id: 'mapel', label: 'Mata Pelajaran', icon: BookOpen, desc: 'Kemenag & Mulok' },
          { id: 'penugasan', label: 'Penugasan SK', icon: FileCheck, desc: 'Guru per Rombel' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedCategory(tab.id as ImportCategory);
                setFile(null);
                setParsedRows([]);
                setParseError(null);
                setShowConfirmCommit(false);
                setIsCommitted(false);
                setCommitSummary(null);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-emerald-700 bg-emerald-50/75 shadow-xs ring-1 ring-amber-400'
                  : 'border-emerald-200/80 bg-white hover:border-amber-400 hover:bg-emerald-50/35'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
              <p className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>{tab.label}</p>
              <p className="text-[10px] text-slate-500 truncate">{tab.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Box Langkah 1 & 2: Unduh Template & Unggah Berkas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Langkah 1
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-2">Unduh Template Format Resmi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gunakan template CSV resmi (mendukung pemisah koma maupun titik koma dari Excel Indonesia).
              </p>
            </div>
            <FileSpreadsheet className="w-8 h-8 text-emerald-500/30" />
          </div>

          <button
            onClick={() => downloadTemplate(selectedCategory)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg border border-emerald-200 transition-colors w-full justify-center"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Unduh Template CSV ({selectedCategory.toUpperCase()})</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                Langkah 2
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-2">Pilih Berkas CSV Data Madrasah</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Untuk impor siswa, isi kolom <code className="font-mono bg-emerald-50 text-emerald-900 px-1 rounded">Tingkat_Kelas</code> (1–6) agar siswa otomatis masuk rombel sesuai tingkatnya.
              </p>
            </div>
            <Upload className="w-8 h-8 text-amber-500/40" />
          </div>

          <label className="flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 text-xs font-bold rounded-lg cursor-pointer transition-all shadow-xs w-full">
            <Upload className="w-4 h-4" />
            <span>{file ? `Ganti Berkas: ${file.name}` : 'Pilih Berkas CSV'}</span>
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      {parseError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-2.5 text-xs text-rose-800 font-medium">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Summary Box & Confirmation */}
      {parsedRows.length > 0 && !isCommitted && (
        <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800">Total Baris:</span>
                <span className="font-mono bg-emerald-50 px-2 py-0.5 rounded font-bold text-emerald-950 border border-emerald-200">
                  {parsedRows.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Valid: {validCount}</span>
              </div>
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Peringatan: {warningCount}</span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                  <XCircle className="w-4 h-4" />
                  <span>Kesalahan: {errorCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                  setShowConfirmCommit(false);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 font-medium"
              >
                Batalkan
              </button>
              <button
                onClick={() => setShowConfirmCommit(true)}
                disabled={isProcessing || errorCount > 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 text-xs font-bold rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                <FileCheck className="w-4 h-4" />
                <span>{isProcessing ? 'Menyimpan Data...' : `Simpan ${validCount + warningCount} Data Siap Impor`}</span>
              </button>
            </div>
          </div>

          {showConfirmCommit && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-emerald-950 font-medium">
                Konfirmasi impor <strong>{validCount + warningCount}</strong> baris data{' '}
                <strong>{selectedCategory.toUpperCase()}</strong> ke database operasional madrasah?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowConfirmCommit(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-slate-700 font-semibold hover:bg-emerald-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold hover:from-amber-500 hover:to-yellow-500"
                >
                  Ya, Simpan Sekarang
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hasil Sukses Komitmen */}
      {isCommitted && commitSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-emerald-950 text-sm">Proses Impor Data Selesai!</h4>
            <p className="text-emerald-800">
              Sebanyak <strong>{commitSummary.success}</strong> baris data {selectedCategory} berhasil disimpan ke database operasional.{' '}
              {selectedCategory === 'siswa' && (commitSummary.placedInClass ?? 0) > 0
                ? `${commitSummary.placedInClass} siswa langsung menempati rombel sesuai data CSV.`
                : ''}
              {commitSummary.failed > 0 ? ` (${commitSummary.failed} baris gagal).` : ''}
            </p>
            {commitSummary.details && commitSummary.details.length > 0 && (
              <ul className="list-disc list-inside text-rose-700 text-[11px] pt-1">
                {commitSummary.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            <button
              onClick={() => {
                setFile(null);
                setParsedRows([]);
                setIsCommitted(false);
              }}
              className="mt-2 inline-flex items-center gap-1 text-emerald-800 hover:text-amber-700 font-bold underline"
            >
              Impor Berkas Lainnya
            </button>
          </div>
        </div>
      )}

      {/* Pratinjau Tabel Baris per Baris */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-emerald-200/80 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/60 border-b border-emerald-200/80 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">Pratinjau & Validasi Baris Data Sebelum Disimpan</h4>
            <span className="text-[11px] text-slate-500">Baris dengan status kesalahan (merah) harus diperbaiki sebelum disimpan</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-emerald-50/95 backdrop-blur-xs text-emerald-950 font-semibold border-b border-emerald-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Baris</th>
                  <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  <th className="py-2.5 px-4">Ringkasan Nilai Kolom</th>
                  {(selectedCategory === 'siswa' || selectedCategory === 'penugasan') && (
                    <th className="py-2.5 px-4 w-36">Rombel Tujuan</th>
                  )}
                  <th className="py-2.5 px-4">Catatan Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                {parsedRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`hover:bg-emerald-50/35 transition-colors ${
                      row.status === 'error'
                        ? 'bg-rose-50/50'
                        : row.status === 'warning'
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">#{row.rowNumber}</td>
                    <td className="py-2.5 px-3 text-center">
                      {row.status === 'valid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-sans">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Valid</span>
                        </span>
                      )}
                      {row.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-sans">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Periksa</span>
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-sans">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Gagal</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 max-w-md truncate font-sans">
                      {Object.entries(row.data)
                        .filter(([k]) => !k.startsWith('__'))
                        .slice(0, 5)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </td>
                    {(selectedCategory === 'siswa' || selectedCategory === 'penugasan') && (
                      <td className="py-2.5 px-4 font-sans">
                        {row.resolvedClassName ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold">
                            <School className="w-3 h-3 text-amber-600" />
                            <span>{row.resolvedClassName}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum diatur</span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 px-4 font-sans text-xs">
                      {row.messages.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-rose-700 font-medium text-[11px]">
                          {row.messages.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">Format siap disimpan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
