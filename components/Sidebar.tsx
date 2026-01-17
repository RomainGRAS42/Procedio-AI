
import React from 'react';
import { UserRole, ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  userRole: UserRole;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, userRole, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-shapes', roles: [UserRole.MANAGER] },
    { id: 'statistics', label: 'Analyses', icon: 'fa-chart-pie', roles: [UserRole.MANAGER] },
    { id: 'procedures', label: 'Procédures', icon: 'fa-book-open', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
    { id: 'notes', label: 'Mes Notes', icon: 'fa-note-sticky', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
    { id: 'account', label: 'Paramètres', icon: 'fa-user-gear', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="w-72 glass-sidebar text-slate-400 flex flex-col h-screen sticky top-0 z-50 shadow-2xl">
      <div className="p-10 flex items-center gap-5">
        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 shrink-0">
          <i className="fa-solid fa-bolt text-xl"></i>
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-black text-white tracking-tighter leading-none">Procedio</h1>
          <div className="h-1 w-6 bg-blue-500 rounded-full mt-1.5"></div>
        </div>
      </div>

      <nav className="flex-1 px-6 py-4 space-y-3 overflow-y-auto">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewType)}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group relative ${
              currentView === item.id 
                ? 'bg-white/10 text-white shadow-lg backdrop-blur-sm' 
                : 'hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {currentView === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_12px_rgba(59,130,246,0.8)]"></div>
            )}
            <div className="w-6 flex justify-center">
              <i className={`fa-solid ${item.icon} text-lg transition-all duration-300 ${
                currentView === item.id ? 'text-blue-400 scale-110' : 'group-hover:scale-110'
              }`}></i>
            </div>
            <span className="font-bold tracking-tight text-xs uppercase pt-0.5">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-8 mt-auto">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-rose-500/10 text-rose-400 font-black hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 uppercase text-[10px] tracking-widest"
        >
          <i className="fa-solid fa-power-off"></i>
          Quitter
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
