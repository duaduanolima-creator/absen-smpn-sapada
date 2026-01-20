
import React, { useState } from 'react';
import { User as UserIcon, LogOut, IdCard, BadgeCheck, Briefcase, School, CheckCircle, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import { User } from '../types';

interface ProfileProps {
  user: User;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  const getInitials = (name: string) => {
    const n = name.replace(/[^a-zA-Z ]/g, "").trim();
    const parts = n.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleLogoutClick = () => {
    setShowConfirmModal(true);
  };

  const cancelLogout = () => {
    setShowConfirmModal(false);
  };

  const proceedLogout = () => {
    setShowConfirmModal(false);
    setShowSuccessNotification(true);
    
    // Tampilkan notifikasi sukses selama 1.5 detik sebelum logout sebenarnya
    setTimeout(() => {
      onLogout();
    }, 1500);
  };

  const infoItems = [
    { 
      icon: <IdCard size={18} className="text-indigo-400" />, 
      label: 'NIP', 
      value: user.nip 
    },
    { 
      icon: <BadgeCheck size={18} className="text-emerald-400" />, 
      label: 'Status Pegawai', 
      value: user.employmentStatus 
    },
    { 
      icon: <Briefcase size={18} className="text-amber-400" />, 
      label: 'Jabatan', 
      value: user.jobTitle || user.role // Prioritas Jabatan Asli (jobTitle)
    },
    { 
      icon: <School size={18} className="text-blue-400" />, 
      label: 'Unit Kerja', 
      value: user.school 
    },
  ];

  const hasCustomAvatar = user.avatar && !user.avatar.includes('ui-avatars.com');

  return (
    <div className="flex-1 pb-24 overflow-y-auto relative">
      <Header title="Profil Saya" />

      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        <div className="relative">
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/20">
            {hasCustomAvatar ? (
               <img 
                 src={user.avatar} 
                 alt={user.name} 
                 className="w-full h-full rounded-full object-cover border-4 border-slate-950 bg-slate-800"
               />
            ) : (
               <div className="w-full h-full rounded-full bg-slate-800 border-4 border-slate-950 flex items-center justify-center">
                  <span className="text-3xl font-black text-white tracking-widest">{getInitials(user.name)}</span>
               </div>
            )}
          </div>
          <div className="absolute bottom-1 right-1 w-7 h-7 bg-indigo-600 rounded-full border-2 border-slate-950 flex items-center justify-center text-white shadow-lg">
            <UserIcon size={14} />
          </div>
        </div>
        <h2 className="mt-5 text-xl font-bold text-white text-center">{user.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-slate-500">
           {/* CHANGE: Display jobTitle here too */}
           <span className="text-xs font-medium uppercase tracking-wider">{user.jobTitle || user.role}</span>
        </div>
      </div>

      <div className="px-6 mb-8">
        <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-5 shadow-inner">
          <h3 className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-4 px-2">Data Kepegawaian</h3>
          <div className="space-y-4">
            {infoItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-1">
                <div className="mt-0.5 p-2 bg-slate-800 rounded-xl">
                  {item.icon}
                </div>
                <div className="flex-1 border-b border-white/5 pb-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight block mb-0.5">{item.label}</span>
                  <span className="text-sm text-slate-200 font-semibold">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="pt-2">
          <button 
            type="button"
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-600/10 border border-red-600/20 text-red-500 font-bold rounded-2xl hover:bg-red-600/20 transition-all active:scale-[0.98]"
          >
            <LogOut size={20} />
            Keluar dari Aplikasi
          </button>
        </div>
      </div>

      <div className="mt-12 text-center text-slate-600 text-[9px] uppercase tracking-widest pb-8">
        Sistem Informasi Kepegawaian v2.1.0<br/>SMPN 1 Padarincang
      </div>

      {/* Modal Konfirmasi Logout */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={cancelLogout} />
          <div className="relative w-full max-w-sm bg-slate-900 rounded-[2rem] p-6 border border-white/10 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Konfirmasi Keluar</h3>
              <p className="text-sm text-slate-400 mb-6 px-4">
                Apakah Anda yakin ingin mengakhiri sesi ini? Anda harus login kembali untuk mengakses aplikasi.
              </p>
              
              <div className="flex w-full gap-3">
                <button 
                  onClick={cancelLogout}
                  className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={proceedLogout}
                  className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors"
                >
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifikasi Sukses Logout */}
      {showSuccessNotification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="flex flex-col items-center text-center animate-in slide-in-from-bottom-8 duration-500">
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                 <CheckCircle size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Berhasil Keluar</h2>
              <p className="text-slate-400">Sampai jumpa kembali, {getInitials(user.name)}!</p>
              <div className="mt-8 w-8 h-8 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
