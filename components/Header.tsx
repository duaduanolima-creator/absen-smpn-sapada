
import React from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="px-6 py-6 flex justify-between items-center bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
      <div>
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">SMPN 1 Padarincang</h2>
        <h1 className="text-xl font-bold text-white">{title}</h1>
      </div>
    </header>
  );
};

export default Header;
