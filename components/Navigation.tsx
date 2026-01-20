
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, User, ShieldCheck } from 'lucide-react';

interface NavigationProps {
  role: 'Guru' | 'Admin';
}

const Navigation: React.FC<NavigationProps> = ({ role }) => {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass border-t border-white/10 safe-bottom z-50 rounded-t-2xl">
      <div className="flex justify-around items-center h-16 px-4">
        <NavLink 
          to="/" 
          className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? (role === 'Admin' ? 'text-amber-400' : 'text-indigo-400') : 'text-slate-500'}`}
        >
          {role === 'Admin' ? <ShieldCheck size={22} /> : <Home size={22} />}
          <span className="text-[10px] font-medium">{role === 'Admin' ? 'Dashboard' : 'Beranda'}</span>
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? (role === 'Admin' ? 'text-amber-400' : 'text-indigo-400') : 'text-slate-500'}`}
        >
          <User size={22} />
          <span className="text-[10px] font-medium">Profil</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default Navigation;
