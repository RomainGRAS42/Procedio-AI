
import React from 'react';
import { UserRole, ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  userRole: UserRole;
  onLogout: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, userRole, onLogout, isOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Accueil', icon: 'fa-house', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
    { id: 'statistics', label: 'Analyses', icon: 'fa-chart-pie', roles: [UserRole.MANAGER] },
    { id: 'procedures', label: 'Procédures', icon: 'fa-book-open', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
    { id: 'notes', label: 'Mes Notes', icon: 'fa-note-sticky', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
    { id: 'account', label: 'Paramètres', icon: 'fa-user-gear', roles: [UserRole.MANAGER, UserRole.TECHNICIAN] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <aside 
      className={`fixed lg:static inset-y-0 left-0 w-72 glass-sidebar text-slate-400 flex flex-col z-[70] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-label="Navigation principale"
    >
      <div className="p-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0" aria-hidden="true">
          <i className="fa-solid fa-bolt"></i>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black text-white tracking-tight leading-none">Procedio</span>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">v2.1 Stable</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto mt-4">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewType)}
            aria-current={currentView === item.id ? 'page' : undefined}
            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group relative ${
              currentView === item.id 
                ? 'bg-blue-600/10 text-white shadow-sm' 
                : 'hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <div className="w-5 flex justify-center" aria-hidden="true">
              <i className={`fa-solid ${item.icon} text-lg transition-colors ${
                currentView === item.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
              }`}></i>
            </div>
            <span className="font-bold tracking-tight text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-white/5">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-rose-500/10 text-rose-400 font-bold hover:bg-rose-500 hover:text-white transition-all text-xs tracking-wider"
          aria-label="Se déconnecter de Procedio"
        >
          <i className="fa-solid fa-power-off"></i>
          DÉCONNEXION
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
