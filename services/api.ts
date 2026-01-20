
export interface SheetUser {
  Username: string;
  Password: string;
  Nama: string;
  NIP: string;
  Role: string;
  Sekolah: string;
  Status: string;
  Avatar?: string;
  [key: string]: any;
}

// URL CSV GOOGLE SHEET SMPN 1 PADARINCANG
export const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAeRvcKVaxjf8e87icZwsr8vFIQneEAsuCcpokxciZGSshpMmU_i8NX2riKVlr3KEbH7jgt9o3P-LS/pub?gid=42211978&single=true&output=csv";

// URL GOOGLE APPS SCRIPT WEB APP (UPDATED)
export const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx1iJP10MEILibj6NCEg-hqGm9hklC6208u05_MbQuPBsDSHtqEmjCAyJRenGAcKwntrg/exec";

// Helper: Parse Date yang lebih robust (menangani ISO string atau format lain)
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

export const fetchUsersFromSheet = async (): Promise<SheetUser[]> => {
  // Helper to validate CSV content
  const isValidCSV = (text: string) => {
    return text && text.length > 0 && !text.trim().startsWith("<!DOCTYPE html>");
  };

  try {
    // Attempt 1: Direct Fetch
    const response = await fetch(SHEET_CSV_URL);
    if (response.ok) {
      const text = await response.text();
      if (isValidCSV(text)) {
        return parseCSV(text);
      }
    }
    throw new Error("Direct fetch failed or invalid content");
  } catch (directError) {
    console.warn("Direct fetch failed, attempting proxy fallback...", directError);
    
    try {
      // Attempt 2: CORS Proxy Fallback (using allorigins.win)
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(SHEET_CSV_URL)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        if (isValidCSV(text)) {
          return parseCSV(text);
        }
      }
      throw new Error("Proxy fetch failed");
    } catch (proxyError) {
      console.error("All fetch attempts failed. Using dummy data.", proxyError);
      return getDummyData();
    }
  }
};

// --- FUNGSI BARU: FETCH DATA DASHBOARD ---
export const fetchDashboardData = async () => {
  try {
    // Add timestamp to prevent caching
    const url = `${GAS_WEBAPP_URL}?action=GET_DASHBOARD_DATA&t=${new Date().getTime()}`;
    
    // Google Apps Script redirect response handling
    const response = await fetch(url, { 
      method: 'GET',
      redirect: "follow"
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Gagal mengambil data dashboard:", error);
    return null;
  }
};

// --- FUNGSI REAL: REKAP BULANAN ---
import { MonthlyRecap } from '../types';

export const fetchMonthlyRecap = async (month: number, year: number): Promise<MonthlyRecap[]> => {
  try {
    // 1. Ambil data User dan Data Absensi (Real)
    const [users, dashboardData] = await Promise.all([
      fetchUsersFromSheet(),
      fetchDashboardData()
    ]);

    if (!dashboardData) return [];

    const { attendance, leaves } = dashboardData; // attendance: Array log absensi, leaves: Array izin/sakit
    const teachers = users.filter(u => u.Role !== 'Admin' && u.Role !== 'Superadmin');
    
    // 2. Hitung Hari Kerja Efektif secara Dinamis
    const now = new Date();
    
    // Tentukan tanggal terakhir yang akan dihitung
    // Jika bulan berjalan: sampai hari ini
    // Jika bulan lalu: sampai akhir bulan tersebut
    // Jika bulan depan: 0 hari
    let limitDay = 0;
    const daysInMonth = new Date(year, month, 0).getDate(); // Mendapatkan jumlah hari dalam bulan tersebut (28/30/31)

    if (year === now.getFullYear() && month === (now.getMonth() + 1)) {
        limitDay = now.getDate(); // Sampai hari ini
    } else if (year < now.getFullYear() || (year === now.getFullYear() && month < (now.getMonth() + 1))) {
        limitDay = daysInMonth; // Full sebulan
    } else {
        limitDay = 0; // Bulan belum terjadi
    }

    // Hitung hari kerja (Senin-Jumat) dari tanggal 1 sampai limitDay
    let effectiveDays = 0;
    for (let d = 1; d <= limitDay; d++) {
        const tempDate = new Date(year, month - 1, d);
        const day = tempDate.getDay();
        if (day !== 0 && day !== 6) { // Bukan Minggu (0) atau Sabtu (6)
            effectiveDays++;
        }
    }
    
    // Hindari pembagian dengan nol
    if (effectiveDays === 0) effectiveDays = 1; 

    // 3. Kalkulasi Per Guru
    const recapData: MonthlyRecap[] = teachers.map(t => {
      // Filter Absensi Masuk (IN) di bulan & tahun yang dipilih
      const presentLogs = attendance.filter((log: any) => {
        if (!log.timestamp || log.type !== 'IN' || log.nip !== t.NIP) return false;
        const d = parseDate(log.timestamp);
        if (!d) return false;
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });

      // Filter Cuti/Izin di bulan & tahun yang dipilih
      const leaveLogs = leaves.filter((log: any) => {
        if (!log.timestamp || log.nip !== t.NIP) return false;
        const d = parseDate(log.timestamp);
        if (!d) return false;
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });

      // Hitung Total (Unique Days)
      const uniquePresenceDays = new Set(
        presentLogs
          .map((l: any) => {
             const d = parseDate(l.timestamp);
             return d ? d.toDateString() : null;
          })
          .filter((d: any) => d !== null)
      ).size;
      
      const hadir = uniquePresenceDays;
      const sakit = leaveLogs.filter((l: any) => l.status === 'Sakit').length;
      const izin = leaveLogs.filter((l: any) => l.status === 'Izin' || l.status === 'Dinas').length;
      
      // Alpha = Hari Efektif - (Hadir + Sakit + Izin)
      let alpha = effectiveDays - (hadir + sakit + izin);
      if (alpha < 0) alpha = 0;
      
      // Jika limitDay 0 (bulan depan), semua 0
      if (limitDay === 0) {
          return { nip: t.NIP, name: t.Nama || t.Username, hadir: 0, sakit: 0, izin: 0, alpha: 0, percentage: 0 };
      }

      // Persentase Kehadiran Fisik
      const percentage = Math.round((hadir / effectiveDays) * 100);

      return {
        nip: t.NIP,
        name: t.Nama || t.Username,
        hadir,
        sakit,
        izin,
        alpha,
        percentage
      };
    });

    // Sort: Persentase Tertinggi -> Terendah
    return recapData.sort((a, b) => b.percentage - a.percentage);

  } catch (error) {
    console.error("Gagal generate rekap real:", error);
    return [];
  }
};

// --- FUNGSI PENGIRIMAN DATA KE GOOGLE APPS SCRIPT ---

export interface SubmissionPayload {
  action: 'ATTENDANCE' | 'TEACHING' | 'LEAVE';
  user: {
    name: string;
    nip: string;
    role: string;
  };
  data: any;
}

export const submitToGoogleSheets = async (payload: SubmissionPayload): Promise<boolean> => {
  try {
    // Menggunakan fetch dengan method POST (no-cors agar tidak blocked browser)
    await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors", 
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // text/plain prevents preflight OPTIONS check which GAS doesn't support
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error("Gagal mengirim data:", error);
    return false;
  }
};

// --- END FUNGSI PENGIRIMAN ---

// Fungsi Helper untuk mapping nama kolom
const normalizeHeader = (header: string): string => {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, ''); 
  
  if (['username', 'user', 'id', 'user_name'].includes(h)) return 'Username';
  if (['password', 'pass', 'sandi', 'katasandi', 'pin'].includes(h)) return 'Password';
  if (['nama', 'name', 'namalengkap', 'fullname', 'nama_lengkap'].includes(h)) return 'Nama';
  if (['nip', 'nomorinduk', 'idpegawai'].includes(h)) return 'NIP';
  if (['role', 'peran', 'jabatan', 'level', 'akses'].includes(h)) return 'Role';
  if (['sekolah', 'school', 'unitkerja', 'instansi'].includes(h)) return 'Sekolah';
  if (['status', 'statuspegawai', 'kepegawaian'].includes(h)) return 'Status';
  if (['avatar', 'foto', 'photo', 'gambar', 'urlfoto'].includes(h)) return 'Avatar';
  
  return header;
};

// Fungsi Helper Parsing 1 Baris CSV
const parseLine = (line: string): string[] => {
  const values: string[] = [];
  let currentVal = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentVal += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentVal); 
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  values.push(currentVal);
  return values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
};

const parseCSV = (text: string): SheetUser[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => normalizeHeader(h));
  
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const user: any = {};
    
    headers.forEach((header, index) => {
      if (header && values[index] !== undefined) {
        user[header] = values[index];
      }
    });

    return user as SheetUser;
  });
};

const getDummyData = (): SheetUser[] => [
  {
    Username: 'guru1',
    Password: '123',
    Nama: 'Bpk. Ahmad Suherman, S.Pd',
    NIP: '198506122010011005',
    Role: 'Guru',
    Sekolah: 'SMPN 1 Padarincang',
    Status: 'PNS / ASN',
    Avatar: 'https://picsum.photos/200?random=1'
  },
  {
    Username: 'admin1',
    Password: '123',
    Nama: 'Hj. Siti Aminah, M.Pd',
    NIP: '197005121995012001',
    Role: 'Admin',
    Sekolah: 'SMPN 1 Padarincang',
    Status: 'Kepala Sekolah',
    Avatar: 'https://picsum.photos/200?random=2'
  }
];
