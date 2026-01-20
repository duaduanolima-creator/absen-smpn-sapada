
import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, LogIn, Eye, EyeOff, ShieldCheck, GraduationCap, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { fetchUsersFromSheet } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'Guru' | 'Admin'>('Guru');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const lastUsername = localStorage.getItem('last_username');
    if (lastUsername) {
      setUsername(lastUsername);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // 1. Ambil data terbaru dari Sheet
      const sheetUsers = await fetchUsersFromSheet();
      
      const inputUser = username.trim();
      const inputPass = password.trim();
      const targetRole = loginMode.toLowerCase();

      // 2. Cari user berdasarkan Username & Password saja (Tanpa cek role dulu)
      const foundAccount = sheetUsers.find(u => {
        const dbUser = String(u.Username || '').trim();
        const dbPass = String(u.Password || '').trim();
        
        // Username tidak case-sensitive, Password case-sensitive
        return dbUser.toLowerCase() === inputUser.toLowerCase() && dbPass === inputPass;
      });

      if (foundAccount) {
        // 3. Jika akun ketemu, baru validasi Role
        const dbRoleRaw = String(foundAccount.Role || '');
        const dbRole = dbRoleRaw.toLowerCase();
        
        let isRoleValid = false;

        if (targetRole === 'admin') {
            // Mode Admin: Wajib mengandung kata 'admin' atau 'kepala'
            isRoleValid = dbRole.includes('admin') || dbRole.includes('kepala');
        } else {
            // Mode Guru (Pegawai): 
            // Mengizinkan Guru DAN Staf Non-Guru (TU, OB, Satpam, dll)
            const allowedKeywords = [
                'guru', 'pengajar', 'pendidik',
                'tu', 'tata usaha', 'administrasi', 'staf', 'staff',
                'ob', 'office boy', 'kebersihan', 
                'perpus', 'pustakawan', 
                'satpam', 'security', 'keamanan', 
                'penjaga', 'waker',
                'operator', 'teknisi'
            ];
            
            isRoleValid = allowedKeywords.some(keyword => dbRole.includes(keyword));
        }

        if (isRoleValid) {
          // --- LOGIN SUKSES ---
          localStorage.setItem('last_username', username);
          
          const appUser: User = {
            id: foundAccount.NIP || Math.random().toString(36).substr(2, 9),
            name: foundAccount.Nama || foundAccount.Username,
            nip: foundAccount.NIP || '-',
            role: loginMode, // System Role: 'Guru' atau 'Admin' (untuk permission)
            jobTitle: foundAccount.Role || loginMode, // Display Role: Jabatan asli dari Excel (misal: "Staf TU")
            avatar: foundAccount.Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(foundAccount.Nama || 'User')}&background=random`,
            school: foundAccount.Sekolah || 'SMPN 1 Padarincang',
            employmentStatus: foundAccount.Status || '-'
          };

          setTimeout(() => {
            onLogin(appUser);
            setIsLoading(false);
          }, 800);

        } else {
          // --- GAGAL: SALAH ROLE ---
          setErrorMessage(`Login Gagal: Akun ditemukan, tetapi akses ditolak. Di sistem status Anda "${dbRoleRaw}", bukan "${loginMode}". Jika Anda staf/pegawai, silakan coba login di mode 'Login Guru'.`);
          setIsLoading(false);
        }
      } else {
        // --- GAGAL: SALAH PASSWORD / USERNAME ---
        setErrorMessage("Username atau Kata Sandi salah. Silakan coba lagi.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Gagal memuat data. Pastikan internet lancar.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-6 py-12 justify-center bg-slate-950 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-purple-600/20 rounded-full blur-[80px]" />

      <div className="text-center mb-10 z-10">
        <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center overflow-hidden transition-all duration-300">
            <img 
              src="https://iili.io/fWETfnt.png" 
              alt="Logo SMPN 1 Padarincang" 
              className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(79,70,229,0.4)]" 
            />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">E-Absensi</h1>
        <p className="text-slate-400 text-sm mt-2">SMPN 1 Padarincang</p>
      </div>

      <div className="bg-slate-900/50 p-1 rounded-2xl border border-white/5 flex mb-8 z-10 relative">
        <button 
          onClick={() => { setLoginMode('Guru'); setErrorMessage(null); }}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${loginMode === 'Guru' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <GraduationCap size={18} />
          Login Guru / Staf
        </button>
        <button 
          onClick={() => { setLoginMode('Admin'); setErrorMessage(null); }}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${loginMode === 'Admin' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ShieldCheck size={18} />
          Login Admin
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 z-10">
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400 leading-relaxed font-medium">{errorMessage}</p>
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <UserIcon size={18} className="text-slate-500" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder-slate-500"
            placeholder={loginMode === 'Guru' ? "Username Guru / Pegawai" : "Username Admin"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock size={18} className="text-slate-500" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            className="w-full pl-11 pr-12 py-4 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder-slate-500"
            placeholder="Kata Sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-indigo-400 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2 ${loginMode === 'Guru' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'}`}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <LogIn size={18} />
              Masuk sebagai {loginMode === 'Guru' ? 'Guru/Staf' : 'Admin'}
            </>
          )}
        </button>
      </form>

      <div className="absolute bottom-6 left-0 right-0 z-10 text-center">
        <p className="text-[10px] text-slate-600 font-medium tracking-wide">
          @2026 SMPN 1 Padarincang, Serang - Banten
        </p>
      </div>
    </div>
  );
};

export default Login;
