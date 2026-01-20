
export interface User {
  id: string;
  name: string;
  nip: string;
  role: 'Guru' | 'Admin';
  jobTitle: string; // Field baru untuk jabatan asli (misal: "Staf TU", "OB")
  avatar: string;
  school: string;
  employmentStatus: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'permission' | 'teaching';

export interface DailyAttendance {
  id: string;
  name: string;
  nip: string;
  timeIn: string | null;
  timeOut: string | null;
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'BELUM HADIR';
  photoUrl?: string | null;
  isLate?: boolean; // Field baru untuk penanda telat
}

export interface TeachingActivity {
  id: string;
  name: string;
  subject: string;
  className: string;
  timeRange: string;
  endTime?: string; // Field baru untuk validasi status Live
}

export interface MonthlyRecap {
  nip: string;
  name: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number; // Sisa dari 20 hari
  percentage: number; // (Hadir / 20) * 100
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
