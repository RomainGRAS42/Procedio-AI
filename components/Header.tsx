
import React from 'react';
import { User, ViewType } from '../types';

interface HeaderProps {
  user: User;
  currentView: ViewType;
}

const Header: React.FC<HeaderProps> = ({ user, currentView }) => {
  const titles: Record<string, string> = {
    dashboard: 'Tableau de bord',
    statistics: 'Analyses & Statistiques',
    procedures: 'Gestion des Procédures',
    notes: 'Mes Notes Personnelles',
    account: 'Paramètres du compte',
    upload: 'Nouvelle Procédure'
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 glass">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{titles[currentView] || 'Procedio'}</h2>
        <p className="text-sm text-slate-500 hidden md:block">
          {currentView === 'dashboard' ? 'Vue d\'ensemble de votre activité' : 'Gérez vos ressources efficacement'}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex flex-col text-right">
          <span className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</span>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full self-end mt-1">
            {user.role}
          </span>
        </div>
        <img 
          src={user.avatarUrl} 
          alt={`Avatar de ${user.firstName}`} 
          className="w-10 h-10 rounded-full border-2 border-slate-200 shadow-sm object-cover hover:ring-2 hover:ring-blue-500 transition-all"
        />
      </div>
    </header>
  );
};

export default Header;
