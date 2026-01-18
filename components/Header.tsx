
import React, { useState } from 'react';
import { User, ViewType, UserRole, Suggestion } from '../types';

interface HeaderProps {
  user: User;
  currentView: ViewType;
  suggestions?: Suggestion[];
  onMenuClick: () => void;
  onSearch: (term: string) => void;
}

const Header: React.FC<HeaderProps> = ({ user, currentView, suggestions = [], onMenuClick, onSearch }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  
  const titles: Record<string, string> = {
    dashboard: 'Tableau de bord',
    statistics: 'Analyses',
    procedures: 'Catalogue',
    notes: 'Mes Notes',
    account: 'Mon Compte',
    upload: 'Publication'
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) {
      onSearch(localSearch);
    }
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 min-w-[200px]">
        <button 
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-xl"
          aria-label="Ouvrir le menu"
        >
          <i className="fa-solid fa-bars-staggered text-xl"></i>
        </button>
        <h2 className="hidden md:block text-xl font-black text-slate-800 tracking-tight">
          {titles[currentView] || 'Procedio'}
        </h2>
      </div>

      {/* BARRE DE RECHERCHE GLOBALE - TOUJOURS PRÉSENTE */}
      <div className="flex-1 max-w-2xl px-4">
        <form onSubmit={handleSearchSubmit} className="relative group">
          <input 
            type="text" 
            placeholder="Rechercher une procédure..."
            className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-slate-700 text-sm shadow-inner"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
          <button type="submit" className="hidden">Rechercher</button>
        </form>
      </div>

      <div className="flex items-center gap-3 md:gap-6 min-w-[200px] justify-end">
        {user.role === UserRole.MANAGER && (
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center relative border border-slate-100"
              aria-label={`${pendingSuggestions.length} notifications`}
            >
              <i className={`fa-solid fa-bell ${pendingSuggestions.length > 0 ? 'animate-bounce' : ''}`}></i>
              {pendingSuggestions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white">
                  {pendingSuggestions.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-slide-up z-50 overflow-hidden">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                   <h4 className="font-bold text-slate-800 text-sm tracking-tight">Suggestions</h4>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {pendingSuggestions.length > 0 ? (
                    pendingSuggestions.map(s => (
                      <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1 gap-2">
                           <span className="text-xs font-bold text-slate-800 truncate">{s.userName}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{s.procedureTitle}</p>
                        <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg mt-2">"{s.content}"</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs">Tout est à jour</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-black text-slate-800 leading-none">{user.firstName}</span>
            <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">{user.role}</span>
          </div>
          <img 
            src={user.avatarUrl} 
            alt="Mon profil" 
            className="w-10 h-10 rounded-xl border border-slate-200 object-cover shadow-sm"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
